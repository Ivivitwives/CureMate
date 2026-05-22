import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    DraggableScrollbarOverlay,
    useDraggableScrollbar,
} from "../../components/custom-scrollbar";
import { DecorativeBackground } from "../../components/decorative-background";
import { Colors } from "../../constants/theme";
import { useThemeContext } from "../../hooks/use-theme-context";

const FREQUENCY_OPTIONS = [
  "Once Daily",
  "Twice Daily",
  "Three Times Daily",
  "Every 6 Hours",
];

const FREQUENCY_TIMES: Record<string, string[]> = {
  "Once Daily": ["08:00"],
  "Twice Daily": ["08:00", "20:00"],
  "Three Times Daily": ["08:00", "14:00", "20:00"],
  "Every 6 Hours": ["06:00", "12:00", "18:00", "00:00"],
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const formatDateLabel = (value: string) => {
  if (!value) return "";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatMonthLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const toIsoDate = (value: Date) =>
  [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const shiftMonths = (value: Date, months: number) =>
  new Date(value.getFullYear(), value.getMonth() + months, 1);

const buildMonthCells = (monthDate: Date) => {
  const firstDayOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const startOffset = firstDayOfMonth.getDay();
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + index);
    return {
      iso: toIsoDate(cellDate),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === monthDate.getMonth(),
    };
  });
};

const isSameIsoDate = (left: string, right: string) => left === right;

const isBetweenIsoDates = (value: string, start: string, end: string) =>
  value > start && value < end;

const countWords = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
};

const limitWords = (value: string, maxWords: number) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
};

export default function AddMedicineScreen() {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [frequencyModalVisible, setFrequencyModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const router = useRouter();
  const scrollbar = useDraggableScrollbar();

  const formattedStartDate = useMemo(
    () => formatDateLabel(startDate),
    [startDate],
  );

  const formattedEndDate = useMemo(() => formatDateLabel(endDate), [endDate]);

  const selectedDateLabel = useMemo(() => {
    if (!startDate) return "Select Start Date";
    if (isMaintenance) return `${formattedStartDate} • Forever`;
    if (!endDate || endDate === startDate) return formattedStartDate;

    return `${formattedStartDate} - ${formattedEndDate}`;
  }, [endDate, formattedEndDate, formattedStartDate, isMaintenance, startDate]);

  const calendarCells = useMemo(
    () => buildMonthCells(calendarMonth),
    [calendarMonth],
  );

  const calendarMonthLabel = useMemo(
    () => formatMonthLabel(toIsoDate(calendarMonth)),
    [calendarMonth],
  );

  const notesWordCount = useMemo(() => countWords(notes), [notes]);

  const handleDosageChange = (value: string) => {
    setDosage(value.replace(/[^0-9]/g, ""));
  };

  const handleNotesChange = (value: string) => {
    setNotes(limitWords(value, 60));
  };

  const handleSave = async () => {
    const dosageValue = dosage ? `${dosage}mg` : "";

    if (!name || !dosageValue || !frequency || !startDate) {
      const message =
        "Please add the medicine name, dosage, frequency, and start date.";
      setSubmitError(message);
      Alert.alert("Missing information", message);
      return;
    }

    setSubmitError("");

    // Navigate to schedule screen to allow the user to edit/add times
    // Use a query-string URL (more reliable across web/native)
    const qs = `?name=${encodeURIComponent(name)}&dosage=${encodeURIComponent(
      dosageValue,
    )}&frequency=${encodeURIComponent(frequency)}&startDate=${encodeURIComponent(
      startDate,
    )}&endDate=${encodeURIComponent(isMaintenance ? "" : endDate || startDate)}${
      isMaintenance ? "&isMaintenance=true" : ""
    }&notes=${encodeURIComponent(notes.trim())}`;
    const target = `/schedule${qs}`;
    console.log("Navigating to", target);
    router.push(target as `/schedule?${string}`);
  };

  const openDateModal = () => {
    const seedDate = startDate || endDate || getTodayIsoDate();
    setDraftStartDate(startDate || seedDate);
    setDraftEndDate(endDate || "");
    setCalendarMonth(parseIsoDate(seedDate));
    setDateModalVisible(true);
  };

  const handleDateSelect = (selectedDate: string) => {
    if (isMaintenance) {
      setDraftStartDate(selectedDate);
      setDraftEndDate("");
      return;
    }

    if (!draftStartDate || draftEndDate) {
      setDraftStartDate(selectedDate);
      setDraftEndDate("");
      return;
    }

    if (isSameIsoDate(selectedDate, draftStartDate)) {
      setDraftEndDate(selectedDate);
      return;
    }

    if (selectedDate < draftStartDate) {
      setDraftEndDate(draftStartDate);
      setDraftStartDate(selectedDate);
      return;
    }

    setDraftEndDate(selectedDate);
  };

  const handleApplyDateRange = () => {
    if (!draftStartDate) return;

    setStartDate(draftStartDate);
    setEndDate(isMaintenance ? "" : draftEndDate || draftStartDate);
    setDateModalVisible(false);
  };

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background }]}
      onLayout={scrollbar.onLayout}
    >
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <ScrollView
        ref={scrollbar.scrollRef as any}
        contentContainerStyle={styles.container}
        onContentSizeChange={scrollbar.onContentSizeChange}
        onScroll={scrollbar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={28} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>
            Add Medicine
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>
            Medicine Name
          </Text>
          <TextInput
            placeholder="e.g. Paracetamol"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Dosage</Text>
          <View
            style={[
              styles.dosageField,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <TextInput
              placeholder="e.g. 500"
              placeholderTextColor={theme.textMuted}
              value={dosage}
              onChangeText={handleDosageChange}
              keyboardType="numeric"
              style={[styles.dosageInput, { color: theme.text }]}
            />
            <View
              style={[
                styles.dosageSuffix,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Text
                style={[
                  styles.dosageSuffixText,
                  { color: theme.textSecondary },
                ]}
              >
                mg
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.text }]}>Notes</Text>
            <Text style={[styles.wordCount, { color: theme.textMuted }]}>
              {notesWordCount} / 60 words
            </Text>
          </View>
          <View
            style={[
              styles.notesCard,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <TextInput
              placeholder="Optional notes about taking this medicine"
              placeholderTextColor={theme.textMuted}
              value={notes}
              onChangeText={handleNotesChange}
              multiline
              textAlignVertical="top"
              style={[styles.notesInput, { color: theme.text }]}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Frequency</Text>
          <TouchableOpacity
            style={[
              styles.selectField,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={() => setFrequencyModalVisible(true)}
          >
            <Text
              style={[
                styles.selectText,
                { color: theme.text },
                !frequency && { color: theme.textMuted },
              ]}
            >
              {frequency || "Select Frequency"}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setIsMaintenance((current) => {
              const next = !current;
              if (next) {
                setEndDate("");
                setDraftEndDate("");
              }
              return next;
            });
          }}
          style={[
            styles.maintenanceButton,
            {
              backgroundColor: isMaintenance
                ? theme.primarySoft
                : theme.surfaceAlt,
              borderColor: isMaintenance ? theme.primary : theme.border,
            },
          ]}
        >
          <View style={styles.maintenanceTextWrap}>
            <Text style={[styles.maintenanceTitle, { color: theme.text }]}>
              Maintenance Medicine
            </Text>
            <Text
              style={[
                styles.maintenanceSubtitle,
                { color: theme.textSecondary },
              ]}
            >
              {isMaintenance ? "Forever" : "Mark as ongoing / forever"}
            </Text>
          </View>
          <MaterialIcons
            name={isMaintenance ? "check-circle" : "radio-button-unchecked"}
            size={22}
            color={isMaintenance ? theme.primary : theme.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
          <TouchableOpacity
            style={[
              styles.dateField,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
            onPress={openDateModal}
          >
            <Text
              style={[
                styles.dateText,
                { color: theme.text },
                !startDate && { color: theme.textMuted },
              ]}
            >
              {selectedDateLabel}
            </Text>
            <MaterialIcons
              name="calendar-today"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {!!submitError && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {submitError}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          activeOpacity={0.9}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>

      <DraggableScrollbarOverlay {...scrollbar} />

      <Modal
        transparent
        animationType="fade"
        visible={frequencyModalVisible}
        onRequestClose={() => setFrequencyModalVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setFrequencyModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Frequency
            </Text>
            {FREQUENCY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      frequency === option
                        ? theme.primarySoft
                        : theme.surfaceAlt,
                    borderColor:
                      frequency === option ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => {
                  setFrequency(option);
                  setFrequencyModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: theme.text },
                    frequency === option && { color: theme.primary },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={dateModalVisible}
        onRequestClose={() => setDateModalVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setDateModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => {}}
          >
            <View style={styles.calendarHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {isMaintenance ? "Select Start Date" : "Select Date Range"}
              </Text>
            </View>

            <View style={styles.calendarMonthRow}>
              <TouchableOpacity
                onPress={() => setCalendarMonth(shiftMonths(calendarMonth, -1))}
                style={[
                  styles.calendarNavButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={24}
                  color={theme.text}
                />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthLabel, { color: theme.text }]}>
                {calendarMonthLabel}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarMonth(shiftMonths(calendarMonth, 1))}
                style={[
                  styles.calendarNavButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.calendarHint, { color: theme.textSecondary }]}>
              {isMaintenance
                ? "Maintenance medicine stays active forever after the start date."
                : "Tap a start date, then tap the end date."}
            </Text>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <Text
                  key={`${label}-${index}`}
                  style={[styles.weekdayLabel, { color: theme.textMuted }]}
                >
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                const isStart = draftStartDate === cell.iso;
                const isEnd = draftEndDate === cell.iso;
                const isInRange =
                  !!draftStartDate &&
                  !!draftEndDate &&
                  isBetweenIsoDates(cell.iso, draftStartDate, draftEndDate);

                return (
                  <TouchableOpacity
                    key={cell.iso}
                    onPress={() => handleDateSelect(cell.iso)}
                    style={[
                      styles.calendarDay,
                      isInRange && { backgroundColor: theme.primarySoft },
                      !cell.inMonth && styles.calendarDayMuted,
                    ]}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.calendarDayCircle,
                        (isStart || isEnd) && {
                          backgroundColor: theme.primary,
                        },
                        isEnd && {
                          backgroundColor: theme.surface,
                          borderWidth: 1.5,
                          borderColor: theme.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: theme.text },
                          !cell.inMonth && {
                            color: theme.textMuted,
                            opacity: 0.5,
                          },
                          (isStart || isEnd) && { color: theme.surface },
                          isEnd && { color: theme.primary },
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rangeSummary}>
              <Text
                style={[styles.rangeSummaryLabel, { color: theme.textMuted }]}
              >
                Selected
              </Text>
              <Text
                style={[styles.rangeSummaryValue, { color: theme.text }]}
                numberOfLines={2}
              >
                {draftStartDate
                  ? isMaintenance
                    ? `${formatDateLabel(draftStartDate)} • Forever`
                    : `${formatDateLabel(draftStartDate)}${
                        draftEndDate
                          ? ` - ${formatDateLabel(draftEndDate)}`
                          : ""
                      }`
                  : "No date selected"}
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.modalSecondaryButton,
                  { backgroundColor: theme.surfaceAlt },
                ]}
                onPress={() => setDateModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalSecondaryText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleApplyDateRange}
              >
                <Text style={styles.modalConfirmText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  container: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1E2430",
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  maintenanceButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  maintenanceTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  maintenanceTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  maintenanceSubtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "500",
  },
  fieldGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2A2F3A",
  },
  wordCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DAE2",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#1E2430",
    fontSize: 15,
  },
  dosageField: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DAE2",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  dosageInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  dosageSuffix: {
    minWidth: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dosageSuffixText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  notesCard: {
    minHeight: 110,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DAE2",
    borderRadius: 16,
    padding: 14,
  },
  notesInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  selectField: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DAE2",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 15,
    color: "#1E2430",
  },
  placeholderText: {
    color: "#A1A6B3",
  },
  dateField: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7DAE2",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 15,
    color: "#1E2430",
  },
  errorText: {
    marginTop: 4,
    marginBottom: 12,
    color: "#C53030",
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    marginTop: 14,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#5D49CF",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },
  calendarHeaderRow: {
    marginBottom: 12,
  },
  calendarMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E2430",
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4F8",
  },
  calendarMonthLabel: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#1E2430",
    flex: 1,
  },
  calendarHint: {
    marginBottom: 12,
    color: "#6D7280",
    fontSize: 13,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#69707E",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayInRange: {
    backgroundColor: "#EEF0F4",
  },
  calendarDayMuted: {
    opacity: 0.35,
  },
  calendarDayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDaySelected: {
    backgroundColor: "#1F232B",
  },
  calendarDayStart: {
    borderTopRightRadius: 19,
    borderBottomRightRadius: 19,
  },
  calendarDayEnd: {
    borderWidth: 1.5,
    borderColor: "#1F232B",
    backgroundColor: "#FFFFFF",
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E2430",
  },
  calendarDayTextMuted: {
    color: "#98A0AE",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
  },
  rangeSummary: {
    borderRadius: 14,
    backgroundColor: "#F7F8FB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  rangeSummaryLabel: {
    color: "#6D7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  rangeSummaryValue: {
    color: "#1E2430",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEF1F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: "#2A2F3A",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOption: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E1E4EC",
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 10,
  },
  modalOptionSelected: {
    borderColor: "#5D49CF",
    backgroundColor: "#F2EEFF",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: "#2A2F3A",
    fontWeight: "600",
  },
  modalOptionTextSelected: {
    color: "#5D49CF",
  },
  modalConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#5D49CF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
