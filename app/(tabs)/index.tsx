import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  getCompletedMedicinesCount,
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

const formatTime = (value: string) => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText, 10);

  if (Number.isNaN(hour) || !minuteText) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = ((hour + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${minuteText} ${suffix}`;
};

export default function HomeScreen() {
  const { homeLogs, homeLoadedVersion, homeVersion, setHomeLogs } =
    useScreenDataCache();
  const [logs, setLogs] = useState<Log[]>(
    () => (homeLogs as Log[] | null) ?? [],
  );
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(!homeLogs);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
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
    async (options?: { force?: boolean; showSpinner?: boolean }) => {
      const force = options?.force ?? false;
      const showSpinner = options?.showSpinner ?? false;

      if (!force && homeLogs && homeLoadedVersion === homeVersion) {
        setLogs(homeLogs as Log[]);
        setLoading(false);
        return;
      }

      // When forcing a reload programmatically (e.g., on focus), avoid
      // triggering the full-screen loading state. Only show the pull-to-refresh
      // spinner when explicitly requested via `showSpinner: true`.
      if (force) {
        if (showSpinner) setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        await checkAndResetDay();
        await markMissedLogs();

        const todayLogs = (await getTodayLogsFirebase()) as Log[];
        const nextCompletedCount = await getCompletedMedicinesCount();
        const unique = Array.from(
          new Map(todayLogs.map((log) => [log.id, log])).values(),
        );

        setHomeLogs(unique);
        setLogs(unique);
        setCompletedCount(nextCompletedCount);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!homeLogs) return;

    setLogs(homeLogs as Log[]);
    setLoading(false);
  }, [homeLogs]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      void loadLogs();
    });

    return unsubscribe;
  }, [loadLogs, navigation]);

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
              void loadLogs({ force: true, showSpinner: true });
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
              <View
                style={[
                  styles.statCard,
                  styles.completedCard,
                  {
                    backgroundColor: theme.success + "12",
                    borderColor: theme.success,
                  },
                ]}
              >
                <Text style={[styles.statNumber, { color: theme.success }]}>
                  {completedCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                  numberOfLines={2}
                >
                  Completed Doses
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
                    {item.dosage}
                  </Text>
                </View>
                <Text style={[styles.time, { color: theme.textSecondary }]}>
                  {formatTime(item.time)}
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
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
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
  completedCard: {
    borderColor: "#C8E8D7",
    backgroundColor: "#F0FAF5",
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
});
