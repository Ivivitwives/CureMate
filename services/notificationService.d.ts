export function requestPermissions(): Promise<boolean>;
export function cancelAllScheduled(): Promise<void>;
export function requestAndScheduleForLogs(logs?: any[]): Promise<number>;
export function rescheduleTodayNotifications(): Promise<number>;
export default {
  requestPermissions: Function,
  cancelAllScheduled: Function,
  requestAndScheduleForLogs: Function,
  rescheduleTodayNotifications: Function,
};
