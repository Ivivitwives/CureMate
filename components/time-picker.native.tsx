import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DatePicker from "react-native-date-picker";
const AnyDatePicker: any = DatePicker;

type Props = {
  open: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  themeMode: "light" | "dark";
};

export function TimePickerModal({ open, value, onCancel, onConfirm }: Props) {
  const [date, setDate] = useState<Date>(value);

  useEffect(() => {
    if (!open) return;
    setDate(value);
  }, [open, value]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={open}
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.overlay}
        onPress={onCancel}
        // capture all touches to prevent background scrolling while modal is open
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Select Time</Text>

          <View style={styles.pickerContainer}>
            {/* Use a any-casted DatePicker to allow androidVariant prop at runtime */}
            <AnyDatePicker
              date={date}
              onDateChange={setDate}
              mode="time"
              locale="en"
              modal={false}
              androidVariant="iosClone"
              style={{ width: "100%" }}
            />
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
              onPress={() => onConfirm(date)}
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
    maxHeight: "76%",
    alignSelf: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  pickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 8,
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
