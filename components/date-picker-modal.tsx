import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  primary: string;
  primarySoft: string;
  border: string;
  overlay: string;
};

type DatePickerModalProps = {
  open: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  theme: ThemeColors;
  onCancel: () => void;
  onConfirm: (value: Date) => void;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const toLocalIsoDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const parseLocalIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const isBefore = (left: Date, right: Date) =>
  left.getTime() < right.getTime() &&
  toLocalIsoDate(left) !== toLocalIsoDate(right);

const isAfter = (left: Date, right: Date) =>
  left.getTime() > right.getTime() &&
  toLocalIsoDate(left) !== toLocalIsoDate(right);

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export function DatePickerModal({
  open,
  title,
  value,
  minimumDate,
  maximumDate,
  theme,
  onCancel,
  onConfirm,
}: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(value);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(value));

  useEffect(() => {
    if (!open) return;
    setSelectedDate(value);
    setCurrentMonth(startOfMonth(value));
  }, [open, value]);

  const monthCells = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const startOffset = firstDayOfMonth.getDay();
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + index);
      return {
        date: cellDate,
        iso: toLocalIsoDate(cellDate),
        day: cellDate.getDate(),
        inMonth: cellDate.getMonth() === currentMonth.getMonth(),
      };
    });
  }, [currentMonth]);

  const canGoPrevious =
    !minimumDate ||
    endOfMonth(addMonths(currentMonth, -1)).getTime() >= minimumDate.getTime();
  const canGoNext =
    !maximumDate ||
    startOfMonth(addMonths(currentMonth, 1)).getTime() <= maximumDate.getTime();

  const selectDate = (date: Date) => {
    if (minimumDate && isBefore(date, minimumDate)) return;
    if (maximumDate && isAfter(date, maximumDate)) return;
    setSelectedDate(date);
  };

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: theme.overlay }]}
        onPress={onCancel}
      >
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => {}}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="event" size={20} color={theme.primary} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {formatDateLabel(selectedDate)}
              </Text>
            </View>
          </View>

          <View style={styles.monthHeader}>
            <Pressable
              disabled={!canGoPrevious}
              onPress={() =>
                setCurrentMonth((current) => addMonths(current, -1))
              }
              style={[
                styles.monthArrow,
                {
                  backgroundColor: theme.surfaceAlt,
                  opacity: canGoPrevious ? 1 : 0.4,
                },
              ]}
            >
              <MaterialIcons name="chevron-left" size={22} color={theme.text} />
            </Pressable>

            <Text style={[styles.monthLabel, { color: theme.text }]}>
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>

            <Pressable
              disabled={!canGoNext}
              onPress={() =>
                setCurrentMonth((current) => addMonths(current, 1))
              }
              style={[
                styles.monthArrow,
                {
                  backgroundColor: theme.surfaceAlt,
                  opacity: canGoNext ? 1 : 0.4,
                },
              ]}
            >
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.text}
              />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text
                key={label}
                style={[styles.weekdayLabel, { color: theme.textSecondary }]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {monthCells.map((cell) => {
              const selected = cell.iso === toLocalIsoDate(selectedDate);
              const disabled =
                (minimumDate && isBefore(cell.date, minimumDate)) ||
                (maximumDate && isAfter(cell.date, maximumDate));

              return (
                <Pressable
                  key={cell.iso}
                  onPress={() => selectDate(cell.date)}
                  disabled={disabled}
                  style={[
                    styles.dayCell,
                    selected && { backgroundColor: theme.primary },
                    !cell.inMonth && { opacity: 0.35 },
                    disabled && { opacity: 0.18 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: selected ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.actionButton,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onConfirm(selectedDate)}
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.actionText, styles.confirmText]}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(109, 87, 217, 0.10)",
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "800",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  confirmText: {
    color: "#FFFFFF",
  },
});
