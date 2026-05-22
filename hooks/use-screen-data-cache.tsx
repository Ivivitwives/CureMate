import { onAuthStateChanged } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth } from "../firebaseConfig";

type CachedRow = Record<string, unknown> & { id: string };

type ScreenDataCacheValue = {
  homeLogs: CachedRow[] | null;
  homeLoadedVersion: number;
  homeVersion: number;
  historyLogsByKey: Record<string, CachedRow[] | null>;
  historyLoadedVersionByKey: Record<string, number>;
  historyVersion: number;
  reportsLogsByKey: Record<string, CachedRow[] | null>;
  reportsLoadedVersionByKey: Record<string, number>;
  reportsVersion: number;
  medicineById: Record<string, CachedRow | null>;
  medicineLoadedVersionById: Record<string, number>;
  medicineVersion: number;
  setHomeLogs: (logs: CachedRow[]) => void;
  setHistoryLogs: (key: string, logs: CachedRow[]) => void;
  setReportsLogs: (key: string, logs: CachedRow[]) => void;
  setMedicine: (medicineId: string, medicine: CachedRow | null) => void;
  invalidateHome: () => void;
  invalidateHistory: () => void;
  invalidateReports: () => void;
  invalidateMedicine: () => void;
  invalidateMedicationData: () => void;
};

const ScreenDataCacheContext = createContext<ScreenDataCacheValue | null>(null);

export function ScreenDataCacheProvider({ children }: { children: ReactNode }) {
  const [homeLogs, setHomeLogsState] = useState<CachedRow[] | null>(null);
  const [homeLoadedVersion, setHomeLoadedVersion] = useState(0);
  const [homeVersion, setHomeVersion] = useState(0);

  const [historyLogsByKey, setHistoryLogsByKey] = useState<
    Record<string, CachedRow[] | null>
  >({});
  const [historyLoadedVersionByKey, setHistoryLoadedVersionByKey] = useState<
    Record<string, number>
  >({});
  const [historyVersion, setHistoryVersion] = useState(0);

  const [reportsLogsByKey, setReportsLogsByKey] = useState<
    Record<string, CachedRow[] | null>
  >({});
  const [reportsLoadedVersionByKey, setReportsLoadedVersionByKey] = useState<
    Record<string, number>
  >({});
  const [reportsVersion, setReportsVersion] = useState(0);

  const [medicineById, setMedicineById] = useState<
    Record<string, CachedRow | null>
  >({});
  const [medicineLoadedVersionById, setMedicineLoadedVersionById] = useState<
    Record<string, number>
  >({});
  const [medicineVersion, setMedicineVersion] = useState(0);

  const setHomeLogs = useCallback(
    (logs: CachedRow[]) => {
      setHomeLogsState(logs);
      setHomeLoadedVersion(homeVersion);
    },
    [homeVersion],
  );

  const setHistoryLogs = useCallback(
    (key: string, logs: CachedRow[]) => {
      setHistoryLogsByKey((current) => ({ ...current, [key]: logs }));
      setHistoryLoadedVersionByKey((current) => ({
        ...current,
        [key]: historyVersion,
      }));
    },
    [historyVersion],
  );

  const setReportsLogs = useCallback(
    (key: string, logs: CachedRow[]) => {
      setReportsLogsByKey((current) => ({ ...current, [key]: logs }));
      setReportsLoadedVersionByKey((current) => ({
        ...current,
        [key]: reportsVersion,
      }));
    },
    [reportsVersion],
  );

  const setMedicine = useCallback(
    (medicineId: string, medicine: CachedRow | null) => {
      setMedicineById((current) => ({ ...current, [medicineId]: medicine }));
      setMedicineLoadedVersionById((current) => ({
        ...current,
        [medicineId]: medicineVersion,
      }));
    },
    [medicineVersion],
  );

  const invalidateHome = useCallback(() => {
    setHomeVersion((current) => current + 1);
  }, []);

  const invalidateHistory = useCallback(() => {
    setHistoryVersion((current) => current + 1);
  }, []);

  const invalidateReports = useCallback(() => {
    setReportsVersion((current) => current + 1);
  }, []);

  const invalidateMedicine = useCallback(() => {
    setMedicineVersion((current) => current + 1);
  }, []);

  const invalidateMedicationData = useCallback(() => {
    setHomeVersion((current) => current + 1);
    setHistoryVersion((current) => current + 1);
    setReportsVersion((current) => current + 1);
    setMedicineVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      // Clear any in-memory caches when auth changes to avoid data leaking
      // between accounts (new user might otherwise see previous user's data).
      setHomeLogsState(null);
      setHomeLoadedVersion(0);
      setHomeVersion((v) => v + 1);

      setHistoryLogsByKey({});
      setHistoryLoadedVersionByKey({});
      setHistoryVersion((v) => v + 1);

      setReportsLogsByKey({});
      setReportsLoadedVersionByKey({});
      setReportsVersion((v) => v + 1);

      setMedicineById({});
      setMedicineLoadedVersionById({});
      setMedicineVersion((v) => v + 1);
    });

    return () => unsub();
  }, []);

  const value = useMemo<ScreenDataCacheValue>(
    () => ({
      homeLogs,
      homeLoadedVersion,
      homeVersion,
      historyLogsByKey,
      historyLoadedVersionByKey,
      historyVersion,
      reportsLogsByKey,
      reportsLoadedVersionByKey,
      reportsVersion,
      medicineById,
      medicineLoadedVersionById,
      medicineVersion,
      setHomeLogs,
      setHistoryLogs,
      setReportsLogs,
      setMedicine,
      invalidateHome,
      invalidateHistory,
      invalidateReports,
      invalidateMedicine,
      invalidateMedicationData,
    }),
    [
      homeLoadedVersion,
      homeLogs,
      homeVersion,
      historyLoadedVersionByKey,
      historyLogsByKey,
      historyVersion,
      reportsLoadedVersionByKey,
      reportsLogsByKey,
      reportsVersion,
      medicineById,
      medicineLoadedVersionById,
      medicineVersion,
      invalidateHome,
      invalidateHistory,
      invalidateReports,
      invalidateMedicine,
      invalidateMedicationData,
      setHomeLogs,
      setHistoryLogs,
      setReportsLogs,
      setMedicine,
    ],
  );

  return (
    <ScreenDataCacheContext.Provider value={value}>
      {children}
    </ScreenDataCacheContext.Provider>
  );
}

export function useScreenDataCache() {
  const context = useContext(ScreenDataCacheContext);
  if (!context) {
    throw new Error(
      "useScreenDataCache must be used within ScreenDataCacheProvider",
    );
  }
  return context;
}
