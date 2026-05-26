import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useRef } from "react";
import { Alert, Keyboard } from "react-native";

type Props = {
  open: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  themeMode: "light" | "dark";
};

export function TimePickerModal({ open, value, onCancel, onConfirm }: Props) {
  const isOpeningRef = useRef(false);

  useEffect(() => {
    if (!open) {
      isOpeningRef.current = false;
      return;
    }

    if (isOpeningRef.current) {
      return;
    }

    isOpeningRef.current = true;
    Keyboard.dismiss();

    try {
      DateTimePickerAndroid.open({
        value,
        mode: "time",
        display: "default",
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            onConfirm(selectedDate);
          }

          onCancel();
        },
      });
    } catch (error) {
      console.error("Failed to open native time picker", error);
      Alert.alert(
        "Time Picker Unavailable",
        "Could not open the native time picker on this device. Please try again.",
      );
      onCancel();
    }
  }, [open, onCancel, onConfirm, value]);

  return null;
}
