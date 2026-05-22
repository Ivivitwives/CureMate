export const calculateAdherence = (logs) => {
  const completed = logs.filter(
    (log) => log.status === "taken" || log.status === "missed",
  ).length;
  const taken = logs.filter((log) => log.status === "taken").length;

  return completed === 0 ? 0 : Math.round((taken / completed) * 100);
};
