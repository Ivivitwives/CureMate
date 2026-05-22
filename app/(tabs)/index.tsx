import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  DraggableScrollbarOverlay,
  useDraggableScrollbar,
} from "../../components/custom-scrollbar";
import { DecorativeBackground } from "../../components/decorative-background";
import { Colors } from "../../constants/theme";
import { auth } from "../../firebaseConfig";
import { useScreenDataCache } from "../../hooks/use-screen-data-cache";
import { useThemeContext } from "../../hooks/use-theme-context";
import {
  getTodayLogsFirebase,
  markLogAsTaken,
} from "../../services/firebaseService";
import { checkAndResetDay, markMissedLogs } from "../../services/schedule";

type Log = {
  id: string;
  medicineId?: string;
  medicineName: string;
  dosage: string;
  time: string;
  status: string;
};

const STATUS_LABELS: Record<string, string> = {
  taken: "Taken",
  missed: "Missed",
  pending: "Pending",
};

const MEDICINE_ICONS = ["medical-services", "medication", "vaccines"];

const parseTimeToMinutes = (time: string) => {
  const value = String(time ?? "").trim();
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i.exec(value);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3]?.toLowerCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const formatReminderTime = (time: string) => {
  const minutes = parseTimeToMinutes(time);
  if (minutes == null) return time;

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hour12 = ((hours24 + 11) % 12) + 1;

  return `${String(hour12).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0",
  )} ${period}`;
};

const getNextPendingLog = (logs: Log[]) => {
  const pending = logs
    .filter((log) => log.status !== "taken" && log.status !== "missed")
    .map((log) => ({
      ...log,
      sortMinutes: parseTimeToMinutes(log.time),
    }))
    .filter((log) => log.sortMinutes != null)
    .sort((left, right) => (left.sortMinutes ?? 0) - (right.sortMinutes ?? 0));

  return pending[0] ?? null;
};

export default function HomeScreen() {
  const { homeLogs, homeLoadedVersion, homeVersion, setHomeLogs } =
    useScreenDataCache();
  const [logs, setLogs] = useState<Log[]>(
    () => (homeLogs as Log[] | null) ?? [],
  );
  const [loading, setLoading] = useState(!homeLogs);
  const [refreshing, setRefreshing] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderData, setReminderData] = useState<Log | null>(null);
  const router = useRouter();
  const scrollbar = useDraggableScrollbar();
  const { setTheme, theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const blurActiveElement = () => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
  };

  const loadLogs = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;

      if (!force && homeLogs && homeLoadedVersion === homeVersion) {
        setLogs(homeLogs as Log[]);
        setLoading(false);
        return;
      }

      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        await checkAndResetDay();
        await markMissedLogs();

        const todayLogs = (await getTodayLogsFirebase()) as Log[];
        const unique = Array.from(
          new Map(todayLogs.map((log) => [log.id, log])).values(),
        );

        setHomeLogs(unique);
        setLogs(unique);
      } catch (error) {
        console.error("Error loading logs:", error);
        Alert.alert("Error", "Failed to load medicines");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [homeLoadedVersion, homeLogs, homeVersion, setHomeLogs],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleMarkTaken = async (id: string) => {
    try {
      setLogs((previousLogs) => {
        const updatedLogs = previousLogs.map((log) =>
          log.id === id ? { ...log, status: "taken" } : log,
        );
        setHomeLogs(updatedLogs);
        return updatedLogs;
      });

      await markLogAsTaken(id);
    } catch (error: any) {
      console.error("[Home] Error marking log as taken:", error);
      Alert.alert("Error", error.message || "Failed to mark medicine as taken");
      await loadLogs({ force: true });
    }
  };

  const onThemePress = async () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    try {
      await setTheme(newTheme);
    } catch (err) {
      console.error(`[Home] Error switching theme:`, err);
    }
  };

  const onBellPress = useCallback(async () => {
    if (notifying) return;

    const reminder = getNextPendingLog(logs);
    if (!reminder) {
      setReminderData(null);
      setReminderModalVisible(true);
      return;
    }

    const message = `You need to take ${reminder.medicineName} by ${formatReminderTime(reminder.time)}.`;

    try {
      setNotifying(true);

      // show in-app reminder card immediately
      setReminderData(reminder);
      setReminderModalVisible(true);

      // keep existing push notification scheduling intact
      if (Platform.OS === "web") {
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Medicine Reminder",
          body: message,
          data: { logId: reminder.id, medicineId: reminder.medicineId },
        },
        trigger: null,
      });
    } catch (error) {
      console.error("[Home] Failed to show reminder notification:", error);
      // still show the in-app card if scheduling fails
      setReminderData(reminder);
      setReminderModalVisible(true);
    } finally {
      setNotifying(false);
    }
  }, [logs, notifying]);

  const takenCount = logs.filter((log) => log.status === "taken").length;
  const missedCount = logs.filter((log) => log.status === "missed").length;
  const pendingCount = logs.filter(
    (log) => log.status !== "taken" && log.status !== "missed",
  ).length;

  const formattedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const userName = auth.currentUser?.displayName?.split(" ")[0] || "John";

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      onLayout={scrollbar.onLayout}
    >
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <FlatList
        ref={scrollbar.scrollRef as any}
        data={logs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadLogs({ force: true });
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.headerBlock}>
              <View style={styles.headerTop}>
                <Text style={[styles.greeting, { color: theme.text }]}>
                  Hello, {userName} 👋
                </Text>
                <View style={styles.headerActions}>
                  <Pressable onPress={onBellPress} style={styles.iconButton}>
                    <Ionicons
                      name="notifications-outline"
                      size={24}
                      color={theme.primary}
                    />
                  </Pressable>
                  <Pressable onPress={onThemePress} style={styles.iconButton}>
                    <Ionicons
                      name={currentTheme === "dark" ? "sunny" : "moon"}
                      size={24}
                      color={theme.primary}
                    />
                  </Pressable>
                </View>
              </View>
              <Text
                style={[styles.subGreeting, { color: theme.textSecondary }]}
              >
                Here is your today's schedule
              </Text>
            </View>

            <View
              style={[
                styles.dateCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.dateText, { color: theme.text }]}>
                {formattedDate}
              </Text>
              <MaterialIcons
                name="calendar-month"
                size={20}
                color={theme.primary}
              />
            </View>

            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  styles.toTakeCard,
                  {
                    backgroundColor: theme.primarySoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {pendingCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  To Take
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  styles.takenCard,
                  {
                    backgroundColor: theme.success + "15",
                    borderColor: theme.success,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: theme.success }]}>
                  {takenCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Taken
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  styles.missedCard,
                  {
                    backgroundColor: theme.danger + "15",
                    borderColor: theme.danger,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: theme.danger }]}>
                  {missedCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Missed
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Today's Medicines
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const status = item.status?.toLowerCase() ?? "pending";
          const isTaken = status === "taken";
          const isMissed = status === "missed";
          const iconName =
            MEDICINE_ICONS[item.medicineName.length % MEDICINE_ICONS.length];
          const iconColor =
            item.medicineName.length % 3 === 0
              ? theme.primary
              : item.medicineName.length % 3 === 1
                ? theme.warning
                : theme.success;

          return (
            <Pressable
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => {
                if (item.medicineId) {
                  blurActiveElement();
                  router.push({
                    pathname: "/medicine",
                    params: { medicineId: item.medicineId },
                  });
                }
              }}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <MaterialIcons
                    name={iconName as any}
                    size={20}
                    color={iconColor}
                  />
                </View>
                <View style={styles.medicineInfo}>
                  <Text style={[styles.name, { color: theme.text }]}>
                    {item.medicineName}
                  </Text>
                  <Text style={[styles.dosage, { color: theme.textSecondary }]}>
                    {item.dosage} • 1 Tablet
                  </Text>
                </View>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {item.time}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <TouchableOpacity
                  disabled={isTaken || isMissed}
                  onPress={() => handleMarkTaken(item.id)}
                  style={[
                    styles.statusChip,
                    isTaken
                      ? [
                          styles.takenChip,
                          { backgroundColor: theme.success + "20" },
                        ]
                      : isMissed
                        ? [
                            styles.missedChip,
                            { backgroundColor: theme.danger + "20" },
                          ]
                        : [
                            styles.pendingChip,
                            { backgroundColor: theme.primarySoft },
                          ],
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTaken
                        ? [styles.takenText, { color: theme.success }]
                        : isMissed
                          ? [styles.missedText, { color: theme.danger }]
                          : [styles.pendingText, { color: theme.primary }],
                    ]}
                  >
                    {STATUS_LABELS[status] ?? "Pending"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {loading
                ? "Loading medicines..."
                : "No medicines scheduled today"}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loading
                ? "Please wait while we load your schedule."
                : "Add a medicine to start tracking your daily adherence."}
            </Text>
            {!loading && (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  blurActiveElement();
                  router.push("/(tabs)/add");
                }}
              >
                <Text style={[styles.emptyButtonText, { color: "#fff" }]}>
                  Add Medicine
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={styles.contentContainer}
        onContentSizeChange={scrollbar.onContentSizeChange}
        onScroll={scrollbar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      {/* Reminder modal card */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setReminderModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Medicine Reminder
                </Text>
                <Text
                  style={[styles.modalBody, { color: theme.textSecondary }]}
                >
                  {reminderData
                    ? `You need to take ${reminderData.medicineName} at ${formatReminderTime(reminderData.time)}.`
                    : "You have no pending medicines for today."}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 12,
                  }}
                >
                  {reminderData?.medicineId && (
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: theme.primary, marginRight: 8 },
                      ]}
                      onPress={() => {
                        setReminderModalVisible(false);
                        blurActiveElement();
                        router.push({
                          pathname: "/medicine",
                          params: { medicineId: reminderData.medicineId },
                        });
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>
                        View
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.modalButtonOutline}
                    onPress={() => setReminderModalVisible(false)}
                  >
                    <Text
                      style={{ color: theme.textSecondary, fontWeight: "700" }}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <DraggableScrollbarOverlay {...scrollbar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  headerBlock: {
    marginBottom: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 8,
  },
  greeting: {
    fontSize: 30,
    fontWeight: "900",
    color: "#121827",
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  subGreeting: {
    marginTop: 4,
    color: "#4F596A",
    fontSize: 14,
    fontWeight: "500",
  },
  dateCard: {
    backgroundColor: "#F8F8FC",
    borderRadius: 12,
    borderColor: "#D7DBE5",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    color: "#242D3C",
    fontSize: 14,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "31.5%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  toTakeCard: {
    borderColor: "#B9C9DE",
    backgroundColor: "#EDF4FC",
  },
  takenCard: {
    borderColor: "#C9D7CF",
    backgroundColor: "#EFF6F1",
  },
  missedCard: {
    borderColor: "#E8CDD2",
    backgroundColor: "#FAF0F2",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2A5FB8",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: "#2A5FB8",
    fontWeight: "700",
  },
  takenNumber: {
    color: "#2A9A61",
  },
  missedNumber: {
    color: "#D44242",
  },
  sectionTitle: {
    fontSize: 18,
    color: "#202938",
    fontWeight: "700",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderColor: "#DEE3EC",
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F0F3FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  medicineInfo: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2837",
  },
  dosage: {
    marginTop: 1,
    color: "#6A7383",
    fontSize: 13,
    fontWeight: "500",
  },
  time: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2B3443",
  },
  statusRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  pendingChip: {
    borderColor: "#F0A44E",
    backgroundColor: "#FFF7EE",
  },
  takenChip: {
    borderColor: "#2FB773",
    backgroundColor: "#ECFAF2",
  },
  missedChip: {
    borderColor: "#DB6D6D",
    backgroundColor: "#FFF1F1",
  },
  statusText: {
    fontWeight: "700",
    fontSize: 12,
  },
  pendingText: {
    color: "#D07F1F",
  },
  takenText: {
    color: "#1F985D",
  },
  missedText: {
    color: "#CC4C4C",
  },
  emptyState: {
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A2A3A",
  },
  emptyText: {
    marginTop: 6,
    color: "#6C7A8F",
    textAlign: "center",
    marginBottom: 14,
  },
  emptyButton: {
    backgroundColor: "#0D3A67",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalButtonOutline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5EBF4",
    backgroundColor: "transparent",
  },
});
