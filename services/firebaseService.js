import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  setDoc,
  serverTimestamp,
  getFirestore 
} from 'firebase/firestore';
import { auth } from '../firebaseConfig';

let db = null;

// Initialize Firestore lazily
const getDb = () => {
  if (!db) {
    db = getFirestore();
  }
  return db;
};

// Get current user ID
const getCurrentUserId = () => {
  return auth.currentUser?.uid;
};

const normalize = (s) => String(s ?? '').trim().toLowerCase();

const normalizeTimeStr = (time) => {
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

const getLogKey = (log) => {
  const date = log.date ?? '';
  const time = normalizeTimeStr(log.time);
  if (log.medicineId) {
    return `${normalize(log.medicineId)}|${date}|${time}`;
  }
  const name = normalize(log.medicineName ?? '');
  const dosage = normalize(log.dosage ?? '');
  return `${name}|${dosage}|${date}|${time}`;
};

export const getTodayLogKeysFirebase = async () => {
  const userId = getCurrentUserId();
  if (!userId) return new Set();

  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(getDb(), 'users', userId, 'logs'),
    where('date', '==', today)
  );

  const querySnapshot = await getDocs(q);
  const keys = querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return `${data.medicineId ?? docSnap.id ?? ''}|${data.date ?? today}|${data.time ?? ''}`;
  });

  return new Set(keys);
};

const getLogKey = (log) => {
  const medicineId = log.medicineId ?? log.id ?? '';
  const date = log.date ?? '';
  const time = log.time ?? '';
  return `${medicineId}|${date}|${time}`;
};

const getStatusRank = (status) => {
  if (status === 'taken') return 3;
  if (status === 'missed') return 2;
  return 1;
};

const dedupeLogs = (logs) => {
  const logMap = new Map();

  for (const log of logs) {
    const key = getLogKey(log);
    const existing = logMap.get(key);

    if (!existing) {
      logMap.set(key, log);
      continue;
    }

    const existingRank = getStatusRank(existing.status);
    const nextRank = getStatusRank(log.status);

    logMap.set(key, {
      ...existing,
      ...log,
      status: nextRank >= existingRank ? log.status : existing.status
    });
  }

  return Array.from(logMap.values());
};

// ========== MEDICINES COLLECTION ==========

/**
 * Add a new medicine for the current user
 */
export const addMedicine = async (medicineData) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const medicine = {
    ...medicineData,
    createdAt: serverTimestamp(),
    userId
  };

  const docRef = await addDoc(collection(getDb(), 'users', userId, 'medicines'), medicine);
  return docRef.id;
};

/**
 * Get all medicines for the current user
 */
export const getMedicines = async () => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const q = query(collection(getDb(), 'users', userId, 'medicines'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Update a medicine
 */
export const updateMedicine = async (medicineId, updates) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const medicineRef = doc(getDb(), 'users', userId, 'medicines', medicineId);
  await updateDoc(medicineRef, updates);
};

/**
 * Get a single medicine
 */
export const getMedicine = async (medicineId) => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const medicineRef = doc(getDb(), 'users', userId, 'medicines', medicineId);
  const docSnap = await getDoc(medicineRef);
  
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// ========== LOGS COLLECTION (users/{uid}/logs) ==========

/**
 * Add a single log entry for the current user
 */
export const addLog = async (logData) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const log = {
    ...logData,
    userId,
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(getDb(), 'users', userId, 'logs'), log);
  return docRef.id;
};

/**
 * Save multiple logs for the current user
 */
export const saveLogs = async (logsArray) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const logsRef = collection(getDb(), 'users', userId, 'logs');
  const docIds = [];

  for (const log of logsArray) {
    const logWithMeta = {
      ...log,
      userId,
      createdAt: serverTimestamp()
    };

    if (log.id) {
      const docRef = doc(getDb(), 'users', userId, 'logs', log.id);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const { status, ...rest } = logWithMeta;
        console.debug('[saveLogs] upserting existing log (merge non-status):', log.id);
        await setDoc(docRef, rest, { merge: true });
      } else {
        console.debug('[saveLogs] creating new log doc:', log.id);
        await setDoc(docRef, logWithMeta);
      }
      docIds.push(log.id);
    } else {
      const docRef = await addDoc(logsRef, logWithMeta);
      docIds.push(docRef.id);
    }
  }

  return docIds;
};

/**
 * Get today's logs for the current user
 */
export const getTodayLogsFirebase = async () => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const today = new Date().toISOString().split('T')[0];
  
  const q = query(
    collection(getDb(), 'users', userId, 'logs'),
    where('date', '==', today)
  );
  
  const querySnapshot = await getDocs(q);
  return dedupeLogs(querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })));
};

/**
 * Get logs for a specific date range
 */
export const getLogsByDateRange = async (startDate, endDate) => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const q = query(
    collection(getDb(), 'users', userId, 'logs'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Update a log entry (mark as taken, missed, etc)
 */
export const updateLog = async (logId, updates) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const logRef = doc(getDb(), 'users', userId, 'logs', logId);
  await updateDoc(logRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

/**
 * Mark a log as taken
 */
export const markLogAsTaken = async (logId) => {
  await updateLog(logId, { status: 'taken' });
};

/**
 * Mark a log as missed
 */
export const markLogAsMissed = async (logId) => {
  await updateLog(logId, { status: 'missed' });
};

/**
 * Get all logs for the current user (paginated)
 */
export const getAllLogs = async (limit = 100) => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const q = query(
    collection(getDb(), 'users', userId, 'logs'),
    // orderBy('date', 'desc'), // Uncomment if firestore has the field indexed
  );
  
  const querySnapshot = await getDocs(q);
  return dedupeLogs(querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .slice(0, limit));
};
