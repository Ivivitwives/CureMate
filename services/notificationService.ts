import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const parseTimeToDate = (timeStr: string) => {
  if (!timeStr) return null;
  // Try to match HH:MM (24h) or H:MM am/pm
  const t = String(timeStr).trim();
  const ampm = t.match(/(am|pm)$/i);
  let hours = 0;
  let minutes = 0;

  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  hours = parseInt(m[1], 10);
  minutes = parseInt(m[2], 10);

  if (ampm) {
    const ap = ampm[1].toLowerCase();
    if (ap === "pm" && hours < 12) hours += 12;
    if (ap === "am" && hours === 12) hours = 0;
  }

  const d = new Date();
  d.setSeconds(0);
  d.setMilliseconds(0);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

export async function requestPermissions() {
  try {
    const res = await Notifications.requestPermissionsAsync();
    // Some platforms return a `granted` boolean, others return a status string.
    // Accept either a truthy `granted` or a status of 'granted'.
    const granted =
      Boolean((res as any).granted) || (res as any).status === "granted";
    return granted;
  } catch (e) {
    console.warn("Notification permission error", e);
    return false;
  }
}

export async function cancelAllScheduled() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("Failed to cancel scheduled notifications", e);
  }
}

// logs: array of {medicineName, dosage, time, status}
export async function requestAndScheduleForLogs(logs: any[] = []) {
  const granted = await requestPermissions();
  if (!granted) throw new Error("Notifications permission not granted");

  let scheduled = 0;
  const now = new Date();

  for (const log of logs) {
    try {
      if (log.status && log.status !== "pending") continue;
      const time = log.time || log.timeString || log.normalizedTime || "";
      const when = parseTimeToDate(time);
      if (!when) continue;
      if (when <= now) continue; // skip past times

      const content = {
        title: `Time for ${log.medicineName ?? "medicine"}`,
        body: `Take ${log.dosage ?? ""}`,
        data: { logId: log.id ?? null },
      } as any;

      // Schedule using a relative seconds trigger to satisfy types across platforms
      const seconds = Math.max(
        1,
        Math.round((when.getTime() - Date.now()) / 1000),
      );
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { seconds, repeats: false, type: "timeInterval" as any },
      });
      scheduled += 1;
    } catch (e) {
      console.warn("Failed to schedule one notification", e);
    }
  }

  return scheduled;
}

export default {
  requestPermissions,
  cancelAllScheduled,
  requestAndScheduleForLogs,
};
