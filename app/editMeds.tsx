import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Keyboard,
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
} from "../components/custom-scrollbar";
import { DecorativeBackground } from "../components/decorative-background";
import { Colors } from "../constants/theme";
import { useScreenDataCache } from "../hooks/use-screen-data-cache";
import { useThemeContext } from "../hooks/use-theme-context";
import { getMedicine, updateMedicine } from "../services/firebaseService";

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

const normalizeDosage = (value: string) => value.replace(/[^0-9]/g, "");

type Medicine = {
  id: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string | null;
  notes?: string;
  times?: string[];
  imageUri?: string | null;
  isMaintenance?: boolean;
};

export default function EditMedicineScreen() {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const router = useRouter();
  const params = useLocalSearchParams();
  const medicineId = String(params.medicineId ?? "");
  const scrollbar = useDraggableScrollbar();
  const {
    medicineById,
    medicineLoadedVersionById,
    medicineVersion,
    setMedicine: setCachedMedicine,
    invalidateMedicationData,
  } = useScreenDataCache();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [frequencyModalVisible, setFrequencyModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [medicineTimes, setMedicineTimes] = useState<string[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const formattedStartDate = useMemo(
    () => formatDateLabel(startDate),
    [startDate],
  );
  const formattedEndDate = useMemo(() => formatDateLabel(endDate), [endDate]);
  const notesWordCount = useMemo(() => countWords(notes), [notes]);

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

  const loadMedicine = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const cached = medicineById[medicineId] as Medicine | null | undefined;
      const loadedVersion = medicineLoadedVersionById[medicineId] ?? -1;

      if (!force && cached && loadedVersion === medicineVersion) {
        setName(String(cached.name ?? ""));
        setDosage(normalizeDosage(String(cached.dosage ?? "")));
        setNotes(String(cached.notes ?? ""));
        setFrequency(String(cached.frequency ?? ""));
        setStartDate(String(cached.startDate ?? ""));
        setEndDate(String(cached.endDate ?? ""));
        setIsMaintenance(Boolean(cached.isMaintenance));
        setMedicineTimes(Array.isArray(cached.times) ? cached.times : []);
        setImageUri(cached.imageUri ?? null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (!medicineId) {
          setLoading(false);
          return;
        }

        const medicine = (await getMedicine(medicineId)) as Medicine | null;
        if (!medicine) {
          setLoading(false);
          return;
        }

        setName(String(medicine.name ?? ""));
        setDosage(normalizeDosage(String(medicine.dosage ?? "")));
        setNotes(String(medicine.notes ?? ""));
        setFrequency(String(medicine.frequency ?? ""));
        setStartDate(String(medicine.startDate ?? ""));
        setEndDate(String(medicine.endDate ?? ""));
        setIsMaintenance(Boolean(medicine.isMaintenance));
        setMedicineTimes(Array.isArray(medicine.times) ? medicine.times : []);
        setImageUri(medicine.imageUri ?? null);
        setCachedMedicine(medicineId, {
          id: medicineId,
          ...medicine,
        });
      } catch (error) {
        console.error("Failed to load medicine for editing", error);
        Alert.alert("Error", "Failed to load medicine details");
      } finally {
        setLoading(false);
      }
    },
    [
      medicineById,
      medicineId,
      medicineLoadedVersionById,
      medicineVersion,
      setCachedMedicine,
    ],
  );

  useEffect(() => {
    void loadMedicine();
  }, [loadMedicine]);

  const handleDosageChange = (value: string) => {
    setDosage(value.replace(/[^0-9]/g, ""));
  };

  const handleNotesChange = (value: string) => {
    setNotes(limitWords(value, 60));
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

  const handleSave = async () => {
    if (!medicineId) return;

    const dosageValue = dosage ? `${dosage}mg` : "";
    if (!name || !dosageValue || !frequency || !startDate) {
      const message =
        "Please add the medicine name, dosage, frequency, and start date.";
      setSubmitError(message);
      Alert.alert("Missing information", message);
      return;
    }

    setSubmitError("");

    const nextTimes = FREQUENCY_TIMES[frequency] ?? medicineTimes;
    const updates = {
      name,
      dosage: dosageValue,
      notes: notes.trim(),
      frequency,
      startDate,
      endDate: isMaintenance ? null : endDate || startDate,
      isMaintenance,
      times: nextTimes,
      imageUri,
    };

    try {
      await updateMedicine(medicineId, updates);
      invalidateMedicationData();
      router.back();
    } catch (error: any) {
      console.error("Failed to update medicine", error);
      Alert.alert("Error", error.message || "Failed to update medicine");
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.screen,
          styles.centered,
          { backgroundColor: theme.background },
        ]}
      >
        <DecorativeBackground theme={theme} currentTheme={currentTheme} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading medicine...
        </Text>
      </View>
    );
  }

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
            Edit Medicine
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
            onPress={() => {
              Keyboard.dismiss();
              openDateModal();
            }}
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
          <Text style={styles.buttonText}>Save Changes</Text>
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
                        isEnd && { borderColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          { color: theme.text },
                          (isStart || isEnd) && { color: "#fff" },
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  styles.modalCancelButton,
                  { backgroundColor: theme.surfaceMuted },
                ]}
                onPress={() => setDateModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
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
  screen: { flex: 1, backgroundColor: "#F6F7FB" },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { fontWeight: "700" },
  container: { padding: 18, paddingTop: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 36 },
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  wordCount: { fontSize: 12, fontWeight: "600" },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  dosageField: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dosageInput: {
    flex: 1,
    fontSize: 15,
    paddingRight: 12,
  },
  dosageSuffix: {
    minWidth: 44,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dosageSuffixText: { fontWeight: "700", fontSize: 13 },
  notesCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
  },
  notesInput: {
    minHeight: 76,
    fontSize: 15,
    lineHeight: 20,
  },
  selectField: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontSize: 15, fontWeight: "500" },
  maintenanceButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  maintenanceTextWrap: { flex: 1, paddingRight: 12 },
  maintenanceTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  maintenanceSubtitle: { fontSize: 12, fontWeight: "500" },
  dateField: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { fontSize: 15, fontWeight: "500" },
  errorText: {
    marginTop: -2,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalOption: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 10,
  },
  modalOptionText: { fontSize: 15, fontWeight: "600" },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonthLabel: { fontSize: 16, fontWeight: "700" },
  calendarHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayLabel: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  calendarDay: {
    width: "14.2857%",
    alignItems: "center",
    marginBottom: 10,
  },
  calendarDayMuted: {
    opacity: 0.45,
  },
  calendarDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "transparent",
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: {
    backgroundColor: "#F2F3F7",
  },
  modalCancelText: {
    fontWeight: "700",
  },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },
});
