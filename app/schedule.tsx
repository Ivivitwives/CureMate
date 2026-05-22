import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DraggableScrollbarOverlay,
  useDraggableScrollbar,
} from "../components/custom-scrollbar";
import { DecorativeBackground } from "../components/decorative-background";
import { TimePickerModal } from "../components/time-picker";
import { Colors } from "../constants/theme";
import { useScreenDataCache } from "../hooks/use-screen-data-cache";
import { useThemeContext } from "../hooks/use-theme-context";
import { addMedicine } from "../services/firebaseService";
import { generateLogsForToday } from "../services/schedule";

const FREQUENCY_TIMES: Record<string, string[]> = {
  "Once Daily": ["08:00"],
  "Twice Daily": ["08:00", "20:00"],
  "Three Times Daily": ["08:00", "14:00", "20:00"],
  "Every 6 Hours": ["06:00", "12:00", "18:00", "00:00"],
};

const to24Hour = (hour12: string, minute: string, period: "AM" | "PM") => {
  const parsedHour = Number.parseInt(hour12, 10);
  if (Number.isNaN(parsedHour) || parsedHour < 1 || parsedHour > 12) {
    return null;
  }

  let hour24 = parsedHour % 12;
  if (period === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${minute}`;
};

const from24Hour = (time24: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time24);
  if (!match) {
    return { hour: "08", minute: "00", period: "AM" as const };
  }

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute,
    period,
  };
};

const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

const displayTime = (t: string) => {
  if (!t) return t;
  const [hh, mm] = t.split(":");
  if (hh == null) return t;
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mm} ${ampm}`;
};

const timeStringToDate = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  const date = new Date();
  if (!match) {
    date.setHours(8, 0, 0, 0);
    return date;
  }

  date.setHours(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    0,
    0,
  );
  return date;
};

const dateToTimeString = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const timePartsToDate = (hour: string, minute: string, period: "AM" | "PM") => {
  const date = new Date();
  const parsedHour = Number.parseInt(hour, 10) % 12;
  const adjustedHour = period === "PM" ? parsedHour + 12 : parsedHour;
  date.setHours(adjustedHour, Number.parseInt(minute, 10), 0, 0);
  return date;
};

export default function ScheduleScreen() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const { invalidateMedicationData } = useScreenDataCache();
  const params = useLocalSearchParams();
  const scrollbar = useDraggableScrollbar();

  const name = String(params.name ?? "");
  const dosage = String(params.dosage ?? "");
  const frequency = String(params.frequency ?? "");
  const startDate = String(params.startDate ?? getTodayIsoDate());
  const isMaintenance = String(params.isMaintenance ?? "") === "true";
  const endDate = isMaintenance ? "" : String(params.endDate ?? startDate);
  const imageUri = String(params.imageUri ?? "");
  const notes = String(params.notes ?? "");

  const initialTimes = useMemo(
    () => FREQUENCY_TIMES[frequency] ?? [],
    [frequency],
  );

  const [times, setTimes] = useState<string[]>(initialTimes);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const seedTime = from24Hour(times[times.length - 1] ?? "08:00");
  const [selectedHour, setSelectedHour] = useState(seedTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(seedTime.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(
    seedTime.period,
  );

  const openTimeModal = () => {
    const seed = from24Hour(times[times.length - 1] ?? "08:00");
    setSelectedHour(seed.hour);
    setSelectedMinute(seed.minute);
    setSelectedPeriod(seed.period);
    setTimePickerOpen(true);
  };

  const addTime = (time?: Date) => {
    const nextTime = time
      ? dateToTimeString(time)
      : to24Hour(selectedHour, selectedMinute, selectedPeriod);

    if (!nextTime) {
      Alert.alert("Please pick a valid time");
      return false;
    }

    if (times.includes(nextTime)) {
      Alert.alert("Time already added");
      return false;
    }

    setTimes((t) => [...t, nextTime]);
    return true;
  };

  const removeTime = (t: string) => {
    setTimes((cur) => cur.filter((x) => x !== t));
  };

  const handleSaveSchedule = async () => {
    if (!name || !dosage) {
      Alert.alert("Missing medicine data");
      return;
    }

    if (times.length === 0) {
      Alert.alert("Please add at least one time");
      return;
    }

    const med = {
      name,
      dosage,
      frequency,
      startDate,
      endDate: isMaintenance ? null : endDate,
      isMaintenance,
      times,
      notes,
      imageUri: imageUri || null,
    };
    try {
      await addMedicine(med);
      const today = getTodayIsoDate();
      if (startDate <= today && (isMaintenance || today <= endDate)) {
        await generateLogsForToday();
      }
      invalidateMedicationData();
      router.replace("/(tabs)");
    } catch (e: any) {
      console.error("Error saving medicine", e);
      Alert.alert("Error", e.message || "Failed to save");
    }
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
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!timePickerOpen}
        bounces={false}
        overScrollMode="never"
        directionalLockEnabled={true}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={26} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Set Schedule
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select times you want to take this medicine
        </Text>

        {times.map((t) => (
          <View key={t} style={styles.timeCard}>
            <View style={styles.timeLeft}>
              <MaterialIcons name="schedule" size={22} color="#3F7AE0" />
              <Text style={styles.timeText}>{displayTime(t)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeTime(t)}
              style={styles.removeBtn}
            >
              <MaterialIcons name="close" size={18} color="#6B6F78" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.actionGroup}>
          <TouchableOpacity style={styles.addTimeBtn} onPress={openTimeModal}>
            <Text style={styles.addTimeText}>+ Add Time</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchedule}>
            <Text style={styles.saveText}>Save Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TimePickerModal
        open={timePickerOpen}
        value={timePartsToDate(selectedHour, selectedMinute, selectedPeriod)}
        onCancel={() => setTimePickerOpen(false)}
        onConfirm={(date: Date) => {
          const nextSeed = from24Hour(dateToTimeString(date));
          setSelectedHour(nextSeed.hour);
          setSelectedMinute(nextSeed.minute);
          setSelectedPeriod(nextSeed.period);
          if (addTime(date)) {
            setTimePickerOpen(false);
          }
        }}
        themeMode={currentTheme === "dark" ? "dark" : "light"}
      />

      <DraggableScrollbarOverlay {...scrollbar} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F7FB", overflow: "hidden" },
  container: { padding: 18, paddingTop: 20, paddingBottom: 120 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  headerSpacer: { width: 36 },
  subtitle: { color: "#6B6F78", marginBottom: 18, textAlign: "center" },
  timeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E9F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
  },
  timeLeft: { flexDirection: "row", alignItems: "center" },
  timeText: { marginLeft: 12, fontSize: 16, fontWeight: "700" },
  removeBtn: { padding: 6, borderRadius: 8 },
  addTimeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6D57D9",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  addTimeText: { color: "#6D57D9", fontWeight: "700" },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#5D49CF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveText: { color: "#fff", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  timePickerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F2FB",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 180,
  },
  periodPickerColumn: {
    width: 78,
    maxHeight: 180,
  },
  timePickerSeparator: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4A4F5E",
    paddingHorizontal: 8,
  },
  timePickerItem: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  timePickerItemSelected: {
    backgroundColor: "#E8E2FA",
  },
  timePickerItemText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#5A6070",
  },
  timePickerItemTextSelected: {
    color: "#4B36CC",
    fontWeight: "800",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
    marginBottom: 14,
  },
  tipText: {
    color: "#5D6372",
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
    color: "#4F5563",
    fontWeight: "700",
  },
  modalConfirmButton: {
    backgroundColor: "#5D49CF",
  },
  modalConfirmText: { color: "#fff", fontWeight: "700" },
  actionGroup: {
    marginTop: 12,
  },
});
