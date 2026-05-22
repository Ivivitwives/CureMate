import { getData, saveData } from './storage';
import { STORAGE_KEYS } from './keys';

export const markAsTaken = async (logId) => {
  const logs = await getData(STORAGE_KEYS.LOGS);

  const updatedLogs = logs.map(log =>
    log.id === logId ? { ...log, status: "taken" } : log
  );

  await saveData(STORAGE_KEYS.LOGS, updatedLogs);
};