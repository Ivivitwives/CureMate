/**
 * One-time script to clean up duplicate logs in Firestore
 * Run with: node scripts/dedupeLogsFirebase.js
 * 
 * Merges duplicate logs (same medicineId, date, time) and keeps the one with highest priority:
 * taken (3) > missed (2) > pending (1)
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  setDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const normalizeTime = (time) => {
  if (!time) return '';
  const t = String(time).trim().toLowerCase();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = m[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  const m2 = t.match(/(\d{1,2}):(\d{2})/);
  if (m2) {
    const hh = String(parseInt(m2[1], 10)).padStart(2, '0');
    return `${hh}:${m2[2]}`;
  }
  return t;
};

const getStatusRank = (status) => {
  if (status === 'taken') return 3;
  if (status === 'missed') return 2;
  return 1;
};

const dedupeLogsForUser = async (userId, targetDate) => {
  console.log(`\n🔍 Deduping logs for user ${userId} on date ${targetDate}...`);

  const logsRef = collection(db, 'users', userId, 'logs');
  const q = query(logsRef, where('date', '==', targetDate));
  const snapshot = await getDocs(q);

  const logsByKey = new Map();

  // Group logs by logical key
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const medId = data.medicineId ?? '';
    const normalizedTime = normalizeTime(data.time);
    const key = `${medId}|${targetDate}|${normalizedTime}`;

    if (!logsByKey.has(key)) {
      logsByKey.set(key, []);
    }
    logsByKey.get(key).push({ id: docSnap.id, data });
  }

  let totalDups = 0;
  let docsDeleted = 0;

  // For each group, keep highest priority and delete rest
  for (const [key, docs] of logsByKey) {
    if (docs.length > 1) {
      totalDups += docs.length - 1;
      console.log(`  📋 Key "${key}" has ${docs.length} duplicates`);

      // Sort by status rank (descending)
      docs.sort((a, b) => getStatusRank(b.data.status) - getStatusRank(a.data.status));

      // Keep the first (highest priority)
      const keep = docs[0];
      console.log(`    ✅ Keeping: id="${keep.id}", status="${keep.data.status}"`);

      // Delete the rest
      for (let i = 1; i < docs.length; i++) {
        const del = docs[i];
        console.log(`    ❌ Deleting: id="${del.id}", status="${del.data.status}"`);
        try {
          await deleteDoc(doc(db, 'users', userId, 'logs', del.id));
          docsDeleted++;
        } catch (error) {
          console.error(`      Error deleting ${del.id}:`, error);
        }
      }
    }
  }

  console.log(`  ✨ Result: Found ${logsByKey.size} unique keys, ${totalDups} duplicates, deleted ${docsDeleted} docs`);
  return { keysCount: logsByKey.size, dupsCount: totalDups, deletedCount: docsDeleted };
};

const main = async () => {
  try {
    // Sign in as test user (you might need to adjust this)
    // For now, use environment variable or hardcoded UID
    const uid = process.env.FIREBASE_UID || auth.currentUser?.uid;

    if (!uid) {
      console.error('❌ No user ID found. Please set FIREBASE_UID environment variable.');
      process.exit(1);
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 Starting dedupe for user: ${uid}`);
    console.log(`📅 Target date: ${today}`);

    const result = await dedupeLogsForUser(uid, today);

    console.log(`\n✅ Dedupe complete!`);
    console.log(`   Unique keys: ${result.keysCount}`);
    console.log(`   Duplicates found: ${result.dupsCount}`);
    console.log(`   Docs deleted: ${result.deletedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during dedupe:', error);
    process.exit(1);
  }
};

main();
