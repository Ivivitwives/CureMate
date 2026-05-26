import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Platform } from "react-native";
import { auth } from "../firebaseConfig";

let db: any = null;

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

export const getUserProfile = async (
  userId?: string,
): Promise<{
  id: string;
  profileImage?: string | null;
  [key: string]: any;
} | null> => {
  const resolvedUserId = userId ?? getCurrentUserId();
  if (!resolvedUserId) return null;

  const userRef = doc(getDb(), "users", resolvedUserId);
  const snapshot = await getDoc(userRef);
  return snapshot.exists()
    ? { id: snapshot.id, ...(snapshot.data() as Record<string, any>) }
    : null;
};

export const uploadProfileImage = async (imageUri: string) => {
  if (Platform.OS === "web") {
    throw new Error(
      "Profile photo uploads are not available on web in this build.",
    );
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(imageUri);
  if (!response.ok) {
    throw new Error("Failed to read selected image");
  }

  const blob = await response.blob();
  const storage = getStorage();
  const imageRef = ref(storage, `profile-images/${user.uid}.jpg`);

  await uploadBytes(imageRef, blob, {
    contentType: "image/jpeg",
  });

  const downloadUrl = await getDownloadURL(imageRef);

  await setDoc(
    doc(getDb(), "users", user.uid),
    {
      profileImage: downloadUrl,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await updateProfile(user, { photoURL: downloadUrl });
  } catch (error) {
    console.warn("Unable to sync auth photoURL", error);
  }

  return downloadUrl;
};

const waitForCurrentUserId = () =>
  new Promise<string | undefined>((resolve) => {
    if (auth.currentUser?.uid) {
      resolve(auth.currentUser.uid);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      unsubscribe();
      resolve(user?.uid ?? undefined);
    });
  });

const waitForCurrentUserIdWithTimeout = async (
  timeoutMs = 5000,
): Promise<string | undefined> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (auth.currentUser?.uid) return auth.currentUser.uid as string;
    const uid = await waitForCurrentUserId();
    if (uid) return uid;
    // small delay before retrying
    await new Promise((r) => setTimeout(r, 250));
  }
  return undefined;
};

const normalize = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

const normalizeTimeStr = (time: any) => {
  if (!time) return "";
  const t = String(time).trim().toLowerCase();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = m[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  const m2 = t.match(/(\d{1,2}):(\d{2})/);
  if (m2) {
    const hh = String(parseInt(m2[1], 10)).padStart(2, "0");
    return `${hh}:${m2[2]}`;
  }
  return t;
};

const toIsoDate = (value: Date) =>
  [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const addDays = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const normalizeTimeForComparison = (time: any) => {
  const normalized = normalizeTimeStr(time);
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
};

const buildLogsForRange = async (endDate: string) => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const medicines = await getMedicines();
  const today = toIsoDate(new Date());
  const rangeEnd = endDate > today ? today : endDate;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const logsToSave: any[] = [];

  for (const medicine of medicines) {
    if (!medicine?.startDate || medicine.startDate > rangeEnd) {
      continue;
    }

    const medicineEnd =
      medicine.endDate && medicine.endDate < rangeEnd
        ? medicine.endDate
        : rangeEnd;
    const medicineTimes = Array.isArray(medicine.times) ? medicine.times : [];

    for (
      let cursor = parseIsoDate(medicine.startDate);
      cursor <= parseIsoDate(medicineEnd);
      cursor = addDays(cursor, 1)
    ) {
      const isoDate = toIsoDate(cursor);

      for (const time of medicineTimes) {
        const normalizedTime = normalizeTimeStr(time);
        const timeMinutes = normalizeTimeForComparison(normalizedTime);
        const isPastDate = isoDate < today;
        const isPastTimeToday =
          isoDate === today && timeMinutes != null && timeMinutes <= nowMinutes;

        logsToSave.push({
          id: `${medicine.id}_${isoDate}_${normalizedTime.replace(/[:\s]/g, "-")}`,
          medicineId: medicine.id,
          medicineName: medicine.name,
          dosage: medicine.dosage,
          date: isoDate,
          time: normalizedTime,
          status: isPastDate || isPastTimeToday ? "missed" : "pending",
        });
      }
    }
  }

  if (logsToSave.length > 0) {
    await saveLogs(logsToSave);
  }

  return logsToSave;
};

const getLogKey = (log: any) => {
  const date = log.date ?? "";
  const time = normalizeTimeStr(log.time);
  if (log.medicineId) {
    return `${normalize(log.medicineId)}|${date}|${time}`;
  }
  const name = normalize(log.medicineName ?? "");
  const dosage = normalize(log.dosage ?? "");
  return `${name}|${dosage}|${date}|${time}`;
};

export const getTodayLogKeysFirebase = async () => {
  const userId = getCurrentUserId();
  if (!userId) return new Set<string>();

  const today = new Date().toISOString().split("T")[0];
  const q = query(
    collection(getDb(), "users", userId, "logs"),
    where("date", "==", today),
  );

  const querySnapshot = await getDocs(q);
  const keys = querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return `${data.medicineId ?? docSnap.id ?? ""}|${data.date ?? today}|${data.time ?? ""}`;
  });

  return new Set(keys);
};

const getStatusRank = (status: string | undefined) => {
  if (status === "taken") return 3;
  if (status === "missed") return 2;
  return 1;
};

const dedupeLogs = (logs: any[]) => {
  if (logs.length === 0) return [];

  const logMap = new Map<string, any>();
  let duplicates = 0;

  for (const log of logs) {
    const key = getLogKey(log);
    const existing = logMap.get(key);

    if (!existing) {
      logMap.set(key, log);
      continue;
    }

    duplicates++;
    const existingRank = getStatusRank(existing.status);
    const newRank = getStatusRank(log.status);
    const keepLog = newRank > existingRank ? log : existing;
    logMap.set(key, keepLog);
  }

  const result = Array.from(logMap.values());
  return result;
};

// ========== MEDICINES COLLECTION ==========

/**
 * Add a new medicine for the current user
 */
export const addMedicine = async (medicineData: any) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  // Normalize times and notes before saving to ensure consistent storage
  const normalizedTimes = Array.isArray(medicineData.times)
    ? medicineData.times.map((t: any) => normalizeTimeStr(t))
    : [];

  const medicine = {
    ...medicineData,
    times: normalizedTimes,
    notes:
      typeof medicineData.notes === "string" ? medicineData.notes.trim() : "",
    createdAt: serverTimestamp(),
    userId,
  };

  const medicinesRef = collection(getDb(), "users", userId, "medicines");
  const providedId = typeof medicineData.id === "string" ? medicineData.id : "";
  const docRef = providedId ? doc(medicinesRef, providedId) : doc(medicinesRef);

  await setDoc(docRef, medicine);
  return docRef.id;
};

/**
 * Create a local medicine ID that can be used for optimistic updates.
 */
export const createMedicineId = () => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  return doc(collection(getDb(), "users", userId, "medicines")).id;
};

/**
 * Get all medicines for the current user
 */
export const getMedicines = async (): Promise<any[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const q = query(collection(getDb(), "users", userId, "medicines"));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Update a medicine
 */
export const updateMedicine = async (medicineId: string, updates: any) => {
  let userId = getCurrentUserId();
  if (!userId) {
    // Try waiting briefly for auth to become available (handles cold start)
    userId = await waitForCurrentUserIdWithTimeout(5000);
  }

  if (!userId) throw new Error("User not authenticated");

  // Normalize times and notes if provided
  const normalizedTimes = Array.isArray(updates.times)
    ? updates.times.map((t: any) => normalizeTimeStr(t))
    : undefined;

  const normalizedNotes =
    typeof updates.notes === "string" ? updates.notes.trim() : undefined;

  const medicineRef = doc(getDb(), "users", userId, "medicines", medicineId);

  const payload: any = { ...updates };
  if (normalizedTimes !== undefined) payload.times = normalizedTimes;
  if (normalizedNotes !== undefined) payload.notes = normalizedNotes;
  payload.updatedAt = serverTimestamp();

  await updateDoc(medicineRef, payload);
  // Sync display fields on existing logs so home/today views reflect edits
  try {
    const logsQuery = query(
      collection(getDb(), "users", userId, "logs"),
      where("medicineId", "==", medicineId),
    );
    const logsSnap = await getDocs(logsQuery);
    for (const logDoc of logsSnap.docs) {
      const updatesForLog: any = {};
      if (payload.name !== undefined) updatesForLog.medicineName = payload.name;
      if (payload.dosage !== undefined) updatesForLog.dosage = payload.dosage;
      if (Object.keys(updatesForLog).length > 0) {
        try {
          await updateDoc(logDoc.ref, updatesForLog);
        } catch (err) {
          console.warn("Failed to sync log", logDoc.id, err);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to query or update logs for medicine sync", err);
  }

  // Remove outdated future/today logs whose time is no longer in the updated schedule
  try {
    const normalizedTimesForMatch = Array.isArray(payload.times)
      ? payload.times.map((t: any) => normalizeTimeStr(t))
      : undefined;

    // Delete all future/today logs for this medicine, then regenerate so old times are removed
    const today = toIsoDate(new Date());
    const allMedicineLogsQuery = query(
      collection(getDb(), "users", userId, "logs"),
      where("medicineId", "==", medicineId),
    );

    const allMedicineLogsSnap = await getDocs(allMedicineLogsQuery);
    for (const logDoc of allMedicineLogsSnap.docs) {
      const data = logDoc.data() as any;
      const logDate = String(data.date ?? "");
      if (logDate >= today) {
        try {
          await deleteDoc(logDoc.ref);
        } catch (err) {
          console.warn("Failed to delete future log", logDoc.id, err);
        }
      }
    }

    // Rebuild logs for the medicine's date range (at least today) to ensure new times exist
    try {
      const regenEnd = payload.endDate ?? today;
      await buildLogsForRange(regenEnd);
    } catch (err) {
      console.warn("Failed to regenerate logs after medicine update", err);
    }
  } catch (err) {
    console.warn("Failed to cleanup or regenerate logs for medicine", err);
  }
};

/**
 * Delete a medicine and its associated logs
 */
export const deleteMedicine = async (medicineId: string) => {
  let userId = getCurrentUserId();
  if (!userId) {
    userId = await waitForCurrentUserIdWithTimeout(5000);
  }

  if (!userId) {
    console.error(`[deleteMedicine] No authenticated user found after wait`);
    throw new Error("User not authenticated (auth not ready)");
  }

  try {
    const db = getDb();
    const medicineRef = doc(db, "users", userId, "medicines", medicineId);
    const logsQuery = query(
      collection(db, "users", userId, "logs"),
      where("medicineId", "==", medicineId),
    );

    const logSnapshot = await getDocs(logsQuery);
    for (const logDoc of logSnapshot.docs) {
      try {
        await deleteDoc(logDoc.ref);
      } catch (err) {
        console.error(
          `[deleteMedicine] Failed to delete log ${logDoc.id}:`,
          err,
        );
        throw err;
      }
    }

    await deleteDoc(medicineRef);
  } catch (err: any) {
    console.error(
      `[deleteMedicine] Error deleting medicine ${medicineId}:`,
      err,
    );
    throw err;
  }
};

/**
 * Get a single medicine
 */
export const getMedicine = async (medicineId: string) => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const medicineRef = doc(getDb(), "users", userId, "medicines", medicineId);
  const docSnap = await getDoc(medicineRef);

  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// ========== LOGS COLLECTION (users/{uid}/logs) ==========

/**
 * Add a single log entry for the current user
 */
export const addLog = async (logData: any) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const log = {
    ...logData,
    userId,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(getDb(), "users", userId, "logs"),
    log,
  );
  return docRef.id;
};

/**
 * Save multiple logs for the current user
 *
 * CRITICAL LOGIC:
 * - For NEW logs: creates with full data + timestamps
 * - For EXISTING logs by KEY (medicineId|date|time): NEVER UPDATE - preserves status
 *   This prevents duplicate logs with different IDs
 */
export const saveLogs = async (logsArray: any[]) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const logsRef = collection(getDb(), "users", userId, "logs");
  const docIds = [];

  for (const log of logsArray) {
    const logDate = log.date ?? toIsoDate(new Date());
    const logKey = `${log.medicineId ?? ""}|${logDate}|${log.time ?? ""}`;
    // Check if a log with this key already exists (regardless of ID)
    const q = query(
      collection(getDb(), "users", userId, "logs"),
      where("medicineId", "==", log.medicineId ?? ""),
      where("date", "==", logDate),
      where("time", "==", log.time ?? ""),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.size > 0) {
      // Log already exists with this key - DO NOT CREATE DUPLICATE
      // Count skip silently to avoid spamming the console
      (saveLogs as any)._skipped = ((saveLogs as any)._skipped || 0) + 1;
      docIds.push(querySnapshot.docs[0].id);
      continue;
    }

    // New log - create with full metadata
    if (log.id) {
      const docRef = doc(getDb(), "users", userId, "logs", log.id);
      const existing = await getDoc(docRef);

      if (!existing.exists()) {
        // Create with this specific ID
        const newLog = {
          ...log,
          userId,
          createdAt: serverTimestamp(),
        };
        await setDoc(docRef, newLog);
        docIds.push(log.id);
      }
    } else {
      // Auto-generate ID
      const newLog = {
        ...log,
        userId,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(logsRef, newLog);
      docIds.push(docRef.id);
    }
  }

  (saveLogs as any)._skipped = 0;

  return docIds;
};

/**
 * Get today's logs for the current user
 */
export const getTodayLogsFirebase = async () => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const today = toIsoDate(new Date());
  await buildLogsForRange(today);

  const q = query(
    collection(getDb(), "users", userId, "logs"),
    where("date", "==", today),
  );

  const querySnapshot = await getDocs(q);
  const todayLogs = querySnapshot.docs.map((doc) => {
    return {
      id: doc.id,
      ...doc.data(),
    };
  }) as any[];

  return dedupeLogs(todayLogs);
};

/**
 * Get logs for a specific date range
 */
export const getLogsByDateRange = async (
  startDate: string,
  endDate: string,
) => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  await buildLogsForRange(endDate);

  const q = query(
    collection(getDb(), "users", userId, "logs"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );

  const querySnapshot = await getDocs(q);
  const raw = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Ensure duplicate logical logs are collapsed before returning
  return dedupeLogs(raw);
};

/**
 * Update a log entry (mark as taken, missed, etc)
 */
export const updateLog = async (logId: string, updates: any) => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");

  const logRef = doc(getDb(), "users", userId, "logs", logId);
  try {
    await setDoc(
      logRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error updating log:", error);
    throw error;
  }
};

/**
 * Mark a log as taken
 */
export const markLogAsTaken = async (logId: string) => {
  await updateLog(logId, { status: "taken" });
};

/**
 * Mark a log as missed
 */
export const markLogAsMissed = async (logId: string) => {
  await updateLog(logId, { status: "missed" });
};

/**
 * Get all logs for the current user (paginated)
 */
export const getAllLogs = async (limit: number = 100) => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const q = query(
    collection(getDb(), "users", userId, "logs"),
    // orderBy('date', 'desc'), // Uncomment if firestore has the field indexed
  );

  const querySnapshot = await getDocs(q);
  const allLogs = querySnapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .slice(0, limit);

  return dedupeLogs(allLogs);
};

/**
 * Get the number of medicines that have completed their full schedule.
 * A medicine is counted when it has an end date, that end date is today or earlier,
 * and every log up to that end date is marked taken.
 */
export const getCompletedMedicinesCount = async () => {
  const userId = getCurrentUserId();
  if (!userId) return 0;

  const medicines = await getMedicines();
  const today = toIsoDate(new Date());
  const allLogs = await getAllLogs(10000);

  const logsByMedicineId = new Map<string, any[]>();
  for (const log of allLogs) {
    const medicineId = String(log.medicineId ?? "");
    if (!medicineId) continue;
    const current = logsByMedicineId.get(medicineId) ?? [];
    current.push(log);
    logsByMedicineId.set(medicineId, current);
  }

  let completedCount = 0;

  for (const medicine of medicines) {
    if (!medicine?.id || medicine.isMaintenance) {
      continue;
    }

    const endDate = String(medicine.endDate ?? "");
    if (!endDate || endDate > today) {
      continue;
    }

    const medicineLogs = logsByMedicineId.get(medicine.id) ?? [];
    const relevantLogs = medicineLogs.filter(
      (log) => String(log.date ?? "") <= endDate,
    );

    if (relevantLogs.length === 0) {
      continue;
    }

    const allTaken = relevantLogs.every(
      (log) => String(log.status ?? "").toLowerCase() === "taken",
    );

    if (allTaken) {
      completedCount += 1;
    }
  }

  return completedCount;
};
