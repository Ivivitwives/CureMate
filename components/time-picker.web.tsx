import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  open: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  themeMode: "light" | "dark";
};

type Period = "AM" | "PM";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

const toParts = (date: Date) => {
  const hours = date.getHours();
  const period: Period = hours >= 12 ? "PM" : "AM";
  const hour12 = ((hours + 11) % 12) + 1;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute: String(date.getMinutes()).padStart(2, "0"),
    period,
  };
};

const toDate = (hour: string, minute: string, period: Period) => {
  const next = new Date();
  const parsedHour = Number.parseInt(hour, 10) % 12;
  const adjustedHour = period === "PM" ? parsedHour + 12 : parsedHour;
  next.setHours(adjustedHour, Number.parseInt(minute, 10), 0, 0);
  return next;
};

export function TimePickerModal({ open, value, onCancel, onConfirm }: Props) {
  const seed = useMemo(() => toParts(value), [value]);
  const [selectedHour, setSelectedHour] = useState(seed.hour);
  const [selectedMinute, setSelectedMinute] = useState(seed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(seed.period);

  useEffect(() => {
    if (!open) return;
    const next = toParts(value);
    setSelectedHour(next.hour);
    setSelectedMinute(next.minute);
    setSelectedPeriod(next.period);
  }, [open, value]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={open}
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Select Time</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerColumn}>
              <Picker
                selectedValue={selectedHour}
                onValueChange={(itemValue) =>
                  setSelectedHour(String(itemValue))
                }
              >
                {HOUR_OPTIONS.map((hour) => (
                  <Picker.Item key={hour} label={hour} value={hour} />
                ))}
              </Picker>
            </View>

            <Text style={styles.separator}>:</Text>

            <View style={styles.pickerColumn}>
              <Picker
                selectedValue={selectedMinute}
                onValueChange={(itemValue) =>
                  setSelectedMinute(String(itemValue))
                }
              >
                {MINUTE_OPTIONS.map((minute) => (
                  <Picker.Item key={minute} label={minute} value={minute} />
                ))}
              </Picker>
            </View>

            <View style={styles.pickerColumn}>
              <Picker
                selectedValue={selectedPeriod}
                onValueChange={(itemValue) =>
                  setSelectedPeriod(itemValue === "PM" ? "PM" : "AM")
                }
              >
                <Picker.Item label="AM" value="AM" />
                <Picker.Item label="PM" value="PM" />
              </Picker>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() =>
                onConfirm(toDate(selectedHour, selectedMinute, selectedPeriod))
              }
            >
              <Text style={styles.confirmText}>Add Time</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    width: "90%",
    maxWidth: 340,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F2FB",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 6,
  },
  pickerColumn: {
    flex: 1,
    minWidth: 70,
  },
  separator: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A4F5E",
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F2F3F7",
  },
  cancelText: {
    color: "#4F5563",
    fontWeight: "700",
  },
  confirmButton: {
    backgroundColor: "#5D49CF",
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});
