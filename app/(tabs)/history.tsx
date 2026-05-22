import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    DraggableScrollbarOverlay,
    useDraggableScrollbar,
} from "../../components/custom-scrollbar";
import { DecorativeBackground } from "../../components/decorative-background";
import { Colors } from "../../constants/theme";
import { useScreenDataCache } from "../../hooks/use-screen-data-cache";
import { useThemeContext } from "../../hooks/use-theme-context";
import { calculateAdherence } from "../../services/analytics";
import { getLogsByDateRange } from "../../services/firebaseService";

type Log = {
  id: string;
  medicineName: string;
  dosage?: string;
  date: string;
  time: string;
  status: "taken" | "missed" | "pending" | string;
};

type ViewMode = "day" | "week" | "month";

const VIEW_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const formatDateLabel = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (date: Date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
};

const startOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

const formatTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
};

const statusLabel = (status: Log["status"]) => {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  return "Pending";
};

const statusTone = (status: Log["status"]) => {
  if (status === "taken") return "taken";
  if (status === "missed") return "missed";
  return "pending";
};

const iconPalette = [
  { background: "#EDF6EF", color: "#34A853", icon: "local-pharmacy" },
  { background: "#EEF7F2", color: "#2F9D65", icon: "wb-sunny" },
  { background: "#F2EEFF", color: "#6D57D9", icon: "medication" },
  { background: "#FFF0F0", color: "#D84A4A", icon: "pill" },
];

export default function HistoryScreen() {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const scrollbar = useDraggableScrollbar();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const {
    historyLogsByKey,
    historyLoadedVersionByKey,
    historyVersion,
    setHistoryLogs,
  } = useScreenDataCache();

  const range = useMemo(() => {
    if (viewMode === "day") {
      const date = toLocalIsoDate(selectedDate);
      return { start: date, end: date };
    }

    if (viewMode === "week") {
      return {
        start: toLocalIsoDate(startOfWeek(selectedDate)),
        end: toLocalIsoDate(endOfWeek(selectedDate)),
      };
    }

    return {
      start: toLocalIsoDate(startOfMonth(selectedDate)),
      end: toLocalIsoDate(endOfMonth(selectedDate)),
    };
  }, [selectedDate, viewMode]);

  const rangeKey = useMemo(
    () => `${viewMode}:${range.start}:${range.end}`,
    [range.end, range.start, viewMode],
  );

  const loadLogs = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const cached = historyLogsByKey[rangeKey];
      const loadedVersion = historyLoadedVersionByKey[rangeKey] ?? -1;

      if (!force && cached && loadedVersion === historyVersion) {
        setLogs(cached as Log[]);
        setLoading(false);
        return;
      }

      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = (await getLogsByDateRange(
          range.start,
          range.end,
        )) as Log[];

        const sorted = [...data].sort((left, right) => {
          if (left.date !== right.date) {
            return left.date.localeCompare(right.date);
          }
          return left.time.localeCompare(right.time);
        });

        setHistoryLogs(rangeKey, sorted);
        setLogs(sorted);
      } catch (error) {
        console.error("Failed to load history logs", error);
        setLogs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      historyLoadedVersionByKey,
      historyLogsByKey,
      historyVersion,
      range.end,
      range.start,
      rangeKey,
      setHistoryLogs,
    ],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const takenCount = logs.filter((log) => log.status === "taken").length;
  const missedCount = logs.filter((log) => log.status === "missed").length;
  const adherence = calculateAdherence(logs);

  const stepDate = (direction: -1 | 1) => {
    if (viewMode === "day") {
      setSelectedDate((current) => addDays(current, direction));
      return;
    }

    if (viewMode === "week") {
      setSelectedDate((current) => addDays(current, direction * 7));
      return;
    }

    setSelectedDate((current) => addMonths(current, direction));
  };

  const currentLabel = useMemo(
    () => formatDateLabel(selectedDate),
    [selectedDate],
  );

  const today = new Date();
  const canStepForward = toLocalIsoDate(selectedDate) < toLocalIsoDate(today);

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background }]}
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
        contentContainerStyle={styles.container}
        onContentSizeChange={scrollbar.onContentSizeChange}
        onScroll={scrollbar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: theme.text }]}>History</Text>

            <View
              style={[
                styles.segmentedControl,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              {VIEW_OPTIONS.map((option) => {
                const active = viewMode === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setViewMode(option.key)}
                    style={[
                      styles.segment,
                      active && { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                        !active && { color: theme.textSecondary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.dateRow}>
              <Pressable
                onPress={() => stepDate(-1)}
                hitSlop={10}
                style={[
                  styles.dateIconButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={30}
                  color={theme.text}
                />
              </Pressable>

              <Text style={[styles.dateLabel, { color: theme.text }]}>
                {currentLabel}
              </Text>

              <View style={styles.dateActions}>
                <Pressable
                  onPress={() => stepDate(1)}
                  hitSlop={10}
                  style={[
                    styles.dateIconButton,
                    { backgroundColor: theme.surfaceAlt },
                    !canStepForward && styles.dateIconButtonDisabled,
                  ]}
                  disabled={!canStepForward}
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={30}
                    color={canStepForward ? theme.text : theme.textMuted}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setSelectedDate(new Date())}
                  hitSlop={10}
                  style={[
                    styles.dateIconButton,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <MaterialIcons
                    name="calendar-today"
                    size={20}
                    color={theme.text}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const palette = iconPalette[index % iconPalette.length];
          const tone = statusTone(item.status);

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: palette.background },
                ]}
              >
                <MaterialIcons
                  name={palette.icon as any}
                  size={22}
                  color={palette.color}
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.medicineName, { color: theme.text }]}>
                  {item.medicineName}
                </Text>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {formatTime(item.time)}
                </Text>
              </View>

              <View style={[styles.statusPill, styles[`statusPill_${tone}`]]}>
                <Text style={[styles.statusText, styles[`statusText_${tone}`]]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons
              name="event-note"
              size={32}
              color={theme.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {loading ? "Loading history..." : "No logs for this period."}
            </Text>
            {loading ? null : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Pull down to refresh or choose a different date range.
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                styles.summaryCardTaken,
                {
                  backgroundColor: theme.successSoft,
                  borderColor: theme.success,
                },
              ]}
            >
              <Text style={[styles.summaryValue, { color: theme.success }]}>
                {takenCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.success }]}>
                Taken
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                styles.summaryCardMissed,
                {
                  backgroundColor: theme.dangerSoft,
                  borderColor: theme.danger,
                },
              ]}
            >
              <Text style={[styles.summaryValue, { color: theme.danger }]}>
                {missedCount}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.danger }]}>
                Missed
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                styles.summaryCardAdherence,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {adherence}%
              </Text>
              <Text
                style={[styles.summaryLabel, { color: theme.textSecondary }]}
              >
                Adherence
              </Text>
            </View>
          </View>
        }
      />

      <DraggableScrollbarOverlay {...scrollbar} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E2430",
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#ECECF3",
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#6B57D9",
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#596174",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dateIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dateIconButtonDisabled: {
    opacity: 0.65,
  },
  dateLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2430",
  },
  dateActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6E8EE",
    padding: 14,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  medicineName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#222838",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: "#667083",
    fontWeight: "600",
  },
  statusPill: {
    minWidth: 74,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  statusPill_taken: {
    backgroundColor: "#F0FAF3",
    borderColor: "#8ED1A2",
  },
  statusPill_missed: {
    backgroundColor: "#FFF3F3",
    borderColor: "#F3A0A0",
  },
  statusPill_pending: {
    backgroundColor: "#F5F6F9",
    borderColor: "#D2D7E2",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800",
  },
  statusText_taken: {
    color: "#2F9D65",
  },
  statusText_missed: {
    color: "#E13C3C",
  },
  statusText_pending: {
    color: "#5C6473",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    color: "#707789",
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  summaryCardTaken: {},
  summaryCardMissed: {},
  summaryCardAdherence: {},
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E2430",
    marginBottom: 4,
  },
  summaryValueMissed: {
    color: "#E13C3C",
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5E6677",
  },
  summaryLabelTaken: {
    color: "#2F9D65",
  },
  summaryLabelMissed: {
    color: "#E13C3C",
  },
});
