import React from "react";
import DatePicker from "react-native-date-picker";

type Props = {
  open: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  themeMode: "light" | "dark";
};

export function TimePickerModal({
  open,
  value,
  onCancel,
  onConfirm,
  themeMode,
}: Props) {
  return (
    <DatePicker
      modal
      mode="time"
      open={open}
      date={value}
      onCancel={onCancel}
      onConfirm={onConfirm}
      theme={themeMode}
    />
  );
}
