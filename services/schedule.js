import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import { auth } from "../firebaseConfig";
import {
    getMedicines,
    getTodayLogsFirebase,
    saveLogs,
    updateLog,
} from "./firebaseService";

// 🧠 Helper: Get today's date (YYYY-MM-DD)
const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const getDb = () => getFirestore();

const getUserId = () => auth.currentUser?.uid;

const getDailyLogMetaRef = (userId) =>
  doc(getDb(), "users", userId, "metadata", "dailyLogs");

const getLogKey = (log) =>
  `${log.medicineId ?? ""}|${log.date ?? ""}|${log.time ?? ""}`;
const normalizeTime = (time) => {
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
  // Already 24h or other format, try to extract HH:MM
  const m2 = t.match(/(\d{1,2}):(\d{2})/);
  if (m2) {
    const hh = String(parseInt(m2[1], 10)).padStart(2, "0");
    return `${hh}:${m2[2]}`;
  }
  return t;
};

// ✅ 1. Check & generate logs (single source of truth for daily generation)
export const checkAndResetDay = async () => {
  const userId = getUserId();
  if (!userId) {
    return;
  }

  const today = getTodayDate();
  const metaRef = getDailyLogMetaRef(userId);

  try {
    const metaSnap = await getDoc(metaRef);
    const lastGeneratedDate = metaSnap.exists()
      ? metaSnap.data()?.lastGeneratedDate
      : null;

    // If already generated today, nothing to do
    if (lastGeneratedDate === today) {
      return;
    }

    // Generate logs for today
    await generateLogsForToday();

    // Mark today as generated
    await setDoc(
      metaRef,
      {
        lastGeneratedDate: today,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error in checkAndResetDay:", error);
    throw error;
  }
};

// ✅ 2. Get today's logs
export const getTodayLogs = async () => {
  return getTodayLogsFirebase();
};

let isGeneratingToday = false;

export const generateLogsForToday = async () => {
  if (isGeneratingToday) {
    return;
  }

  isGeneratingToday = true;
  try {
    const medicines = await getMedicines();
    const today = new Date().toISOString().split("T")[0];
    const userId = getUserId();
    if (!userId) return;

    // Query raw docs to check for existence
    const q = query(
      collection(getDb(), "users", userId, "logs"),
      where("date", "==", today),
    );
    const querySnapshot = await getDocs(q);

    // Build set of existing logical keys
    const existingKeys = new Set();
    const existingStatuses = new Map(); // Track statuses of existing logs
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const medId = data.medicineId ?? "";
      const normalizedTime = normalizeTime(data.time);
      const key = `${medId}|${today}|${normalizedTime}`;
      existingKeys.add(key);
      existingStatuses.set(key, data.status);
    }

    const logs = [];
    for (const med of medicines) {
      if (med.startDate && med.startDate > today) {
        continue;
      }

      if (med.endDate && med.endDate < today) {
        continue;
      }

      const medicineTimes = Array.isArray(med.times) ? med.times : [];

      for (const time of medicineTimes) {
        const normalizedTime = normalizeTime(time);
        const safeTime = normalizedTime.replace(/[:\s]/g, "-");
        const deterministicId = `${med.id}_${today}_${safeTime}`;
        const logKey = `${med.id}|${today}|${normalizedTime}`;

        if (existingKeys.has(logKey)) {
          continue;
        }

        logs.push({
          id: deterministicId,
          medicineId: med.id,
          medicineName: med.name,
          dosage: med.dosage,
          date: today,
          time,
          status: "pending",
        });
      }
    }

    if (logs.length > 0) {
      await saveLogs(logs);
    }
  } finally {
    isGeneratingToday = false;
  }
};

// ✅ 4. Mark missed (optional but good feature)
export const markMissedLogs = async () => {
  const now = new Date();
  const userId = getUserId();
  if (!userId) return;

  const today = getTodayDate();
  const q = query(
    collection(getDb(), "users", userId, "logs"),
    where("date", "==", today),
  );

  const snapshot = await getDocs(q);

  for (const logDoc of snapshot.docs) {
    const log = logDoc.data();
    if (log.status !== "pending") continue;

    const [hour, minute] = String(log.time).split(":");
    const logTime = new Date();
    logTime.setHours(hour, minute, 0);

    if (logTime < now) {
      await updateLog(logDoc.id, { status: "missed" });
    }
  }
};

// ✅ 5. Clear all logs (for testing/reset)
export const clearAllLogs = async () => {
  const userId = getUserId();
  if (!userId) return;

  const snapshot = await getDocs(collection(getDb(), "users", userId, "logs"));
  for (const logDoc of snapshot.docs) {
    await deleteDoc(logDoc.ref);
  }
};

// ✅ 6. Force regenerate today (for debugging)
export const regenerateTodayLogs = async () => {
  const userId = getUserId();
  if (!userId) return;

  const today = getTodayDate();
  const snapshot = await getDocs(
    query(
      collection(getDb(), "users", userId, "logs"),
      where("date", "==", today),
    ),
  );

  for (const logDoc of snapshot.docs) {
    await deleteDoc(logDoc.ref);
  }

  await generateTodayLogs();
};
