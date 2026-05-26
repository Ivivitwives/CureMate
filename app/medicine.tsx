import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
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
import { Colors } from "../constants/theme";
import { auth } from "../firebaseConfig";
import { useScreenDataCache } from "../hooks/use-screen-data-cache";
import { useThemeContext } from "../hooks/use-theme-context";
import { deleteMedicine, getMedicine } from "../services/firebaseService";
import { rescheduleTodayNotifications } from "../services/notificationService";

type Medicine = {
  id: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  times?: string[];
  notes?: string;
  imageUri?: string | null;
};

const formatDateLabel = (value?: string) => {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value: string) => {
  const [hourText, minuteText] = value.split(":");
  const hour = parseInt(hourText, 10);
  if (Number.isNaN(hour) || !minuteText) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = ((hour + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${minuteText} ${suffix}`;
};

const formatFrequency = (frequency?: string) => {
  if (!frequency) return "Not set";
  const map: Record<string, string> = {
    "Once Daily": "1 Time a Day",
    "Twice Daily": "2 Times a Day",
    "Three Times Daily": "3 Times a Day",
    "Every 6 Hours": "Every 6 Hours",
  };
  return map[frequency] ?? frequency;
};

export default function MedicineScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const params = useLocalSearchParams();
  const medicineId = String(params.medicineId ?? "");
  const {
    medicineById,
    medicineLoadedVersionById,
    medicineVersion,
    homeLogs,
    setHomeLogs,
    setMedicine: setCachedMedicine,
    invalidateMedicationData,
  } = useScreenDataCache();
  const [medicine, setMedicineState] = useState<Medicine | null>(
    (medicineById[medicineId] as Medicine | null | undefined) ?? null,
  );
  const [loading, setLoading] = useState(!medicineById[medicineId]);
  const [deleting, setDeleting] = useState(false);
  const scrollbar = useDraggableScrollbar();

  const blurActiveElement = () => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
  };

  const loadMedicine = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const cached = medicineById[medicineId] as Medicine | null | undefined;
      const loadedVersion = medicineLoadedVersionById[medicineId] ?? -1;

      if (!force && cached && loadedVersion === medicineVersion) {
        setMedicineState(cached);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (!medicineId) {
          setMedicineState(null);
          return;
        }

        const data = (await getMedicine(medicineId)) as Medicine | null;
        setMedicineState(data);
        setCachedMedicine(medicineId, data as any);
      } catch (error) {
        console.error("Failed to load medicine", error);
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

  const handleDelete = () => {
    console.log("[MedicineScreen] handleDelete button clicked!");
    if (!medicineId) return;

    const medicineName = medicine?.name ?? "this medicine";
    const confirmDelete = () => handleDeleteConfirmed(medicineName);

    if (Platform.OS === "web") {
      // Use browser's native confirm dialog on web
      const message = `Do you want to delete '${medicineName}'?`;
      if (window.confirm(message)) {
        confirmDelete();
      }
    } else {
      // Use React Native Alert on native platforms
      console.log("[MedicineScreen] About to show Alert.alert...");
      Alert.alert(
        `Delete '${medicineName}'`,
        `Do you want to delete '${medicineName}'?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: confirmDelete,
          },
        ],
      );
    }
  };

  const handleDeleteConfirmed = async (medicineName: string) => {
    console.log("[MedicineScreen] Delete confirmed");
    if (deleting) return;
    try {
      blurActiveElement();
      console.log(
        "[MedicineScreen] handleDelete: auth.currentUser:",
        auth.currentUser,
      );
      if (!auth.currentUser?.uid) {
        if (Platform.OS === "web") {
          alert(
            "Not signed in. Your session appears to have expired. Please sign in again and try deleting.",
          );
        } else {
          Alert.alert(
            "Not signed in",
            "Your session appears to have expired. Please sign in again and try deleting.",
          );
        }
        return;
      }
      console.log("[MedicineScreen] Calling deleteMedicine...");

      const previousHomeLogs = homeLogs;
      const optimisticHomeLogs = (homeLogs ?? []).filter(
        (log) => log.medicineId !== medicineId,
      );

      setDeleting(true);
      setCachedMedicine(medicineId, null);
      setHomeLogs(optimisticHomeLogs as any);

      try {
        // Prefer navigation.goBack when available, otherwise navigate to root.
        if (
          navigation &&
          (navigation as any).canGoBack &&
          (navigation as any).canGoBack()
        ) {
          (navigation as any).goBack();
        } else {
          router.replace("/(tabs)");
        }
      } catch (err) {
        router.replace("/(tabs)");
      }

      (async () => {
        try {
          await deleteMedicine(medicineId);
          await rescheduleTodayNotifications();
        } catch (error: any) {
          console.error("[MedicineScreen] Delete medicine failed:", error);
          if (previousHomeLogs) {
            setHomeLogs(previousHomeLogs as any);
          }
          if (medicine) {
            setCachedMedicine(medicineId, medicine as any);
          }
          if (Platform.OS === "web") {
            alert(`Error: ${error.message || "Failed to delete medicine"}`);
          } else {
            Alert.alert("Error", error.message || "Failed to delete medicine");
          }
        } finally {
          setDeleting(false);
        }
      })();
    } catch (error: any) {
      console.error("[MedicineScreen] Delete medicine failed:", error);
      if (Platform.OS === "web") {
        alert(`Error: ${error.message || "Failed to delete medicine"}`);
      } else {
        Alert.alert("Error", error.message || "Failed to delete medicine");
      }
    }
  };

  const handleEdit = () => {
    if (!medicineId) return;
    blurActiveElement();
    router.push({ pathname: "/editMeds", params: { medicineId } });
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
        bounces={false}
        overScrollMode="never"
        directionalLockEnabled={true}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              blurActiveElement();
              try {
                if (
                  navigation &&
                  (navigation as any).canGoBack &&
                  (navigation as any).canGoBack()
                ) {
                  (navigation as any).goBack();
                } else {
                  router.replace("/(tabs)");
                }
              } catch (err) {
                router.replace("/(tabs)");
              }
            }}
            style={styles.iconButton}
          >
            <MaterialIcons name="arrow-back" size={28} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.avatarWrap}>
          <MaterialIcons name="medication" size={46} color={theme.primary} />
        </View>

        <Text style={[styles.name, { color: theme.text }]}>
          {loading ? "Loading..." : medicine?.name || "Medicine"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {medicine?.dosage ? `${medicine.dosage}` : "No dosage set"}
        </Text>

        <View style={styles.infoBlock}>
          <InfoRow
            theme={theme}
            label="Frequency"
            value={formatFrequency(medicine?.frequency)}
            icon="repeat"
          />
          <InfoRow
            theme={theme}
            label="Times"
            value={
              medicine?.times?.length
                ? medicine.times.map(formatTime).join(", ")
                : "Not set"
            }
            icon="schedule"
          />
          <InfoRow
            theme={theme}
            label="Start Date"
            value={formatDateLabel(medicine?.startDate)}
            icon="event"
          />
          <InfoRow
            theme={theme}
            label="Notes"
            value={medicine?.notes || "After food"}
            icon="description"
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.editButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.primary,
              },
            ]}
            onPress={handleEdit}
          >
            <Text style={[styles.editText, { color: theme.primary }]}>
              Edit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.danger,
              },
              deleting && styles.buttonDisabled,
            ]}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Text style={[styles.deleteText, { color: theme.danger }]}>
              {deleting ? "Deleting..." : "Delete"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DraggableScrollbarOverlay {...scrollbar} />
    </View>
  );
}

function InfoRow({
  theme,
  label,
  value,
  icon,
}: {
  theme: (typeof Colors)[keyof typeof Colors];
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        {
          backgroundColor: theme.surfaceAlt,
          borderColor: theme.border,
        },
      ]}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={theme.textSecondary}
        style={styles.infoIcon}
      />
      <View style={styles.infoTextWrap}>
        <Text style={[styles.infoLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.textSecondary }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F7FB", overflow: "hidden" },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  topRow: { flexDirection: "row", justifyContent: "flex-start" },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarWrap: {
    alignSelf: "center",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#E7E1FA",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  name: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: "#1B1F2A",
  },
  subtitle: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 16,
    color: "#555E6F",
    marginBottom: 26,
  },
  infoBlock: { gap: 18 },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  infoIcon: { marginRight: 14, marginTop: 2 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 15, fontWeight: "700" },
  infoValue: { marginTop: 4, fontSize: 15, lineHeight: 21 },
  actionsRow: { flexDirection: "row", gap: 14, marginTop: 32 },
  editButton: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  editText: { fontSize: 16, fontWeight: "700" },
  deleteButton: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontSize: 16, fontWeight: "700" },
  buttonDisabled: {
    opacity: 0.75,
  },
});
