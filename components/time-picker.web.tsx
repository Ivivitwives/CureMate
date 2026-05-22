import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

type Props = {
  open: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  themeMode: "light" | "dark";
};

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const PERIOD_OPTIONS = ["AM", "PM"] as const;
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_COUNT = 5;
const WHEEL_PADDING_VERTICAL = WHEEL_ITEM_HEIGHT * 2;
const WHEEL_REPEAT_COUNT = 3;
const WHEEL_COLUMN_WIDTH = 74;
const PERIOD_COLUMN_WIDTH = 58;

type Period = (typeof PERIOD_OPTIONS)[number];

const toParts = (date: Date) => {
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute,
    period,
  };
};

const toDate = (hour: string, minute: string, period: Period) => {
  const next = new Date();
  const parsedHour = Number.parseInt(hour, 10) % 12;
  next.setHours(
    period === "PM" ? parsedHour + 12 : parsedHour,
    Number.parseInt(minute, 10),
    0,
    0,
  );
  return next;
};

type WheelColumnProps = {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  width?: number;
};

function WheelColumn({
  options,
  value,
  onChange,
  width = 92,
}: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const repeatedOptions = useMemo(
    () => Array.from({ length: WHEEL_REPEAT_COUNT }, () => options).flat(),
    [options],
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({
      y: index * WHEEL_ITEM_HEIGHT,
      animated,
    });
  }, []);

  useEffect(() => {
    const initialIndex = options.length + selectedIndex;
    const frame = requestAnimationFrame(() => {
      scrollToIndex(initialIndex, false);
    });

    return () => cancelAnimationFrame(frame);
  }, [options.length, scrollToIndex, selectedIndex, value]);

  const updateFromOffset = useCallback(
    (offsetY: number) => {
      if (!options.length) return;

      const rawIndex = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
      const normalizedIndex =
        ((rawIndex % options.length) + options.length) % options.length;
      const middleCopyIndex = options.length + normalizedIndex;

      if (rawIndex < options.length || rawIndex >= options.length * 2) {
        requestAnimationFrame(() => {
          scrollToIndex(middleCopyIndex, false);
        });
      }

      onChange(options[normalizedIndex]);
    },
    [onChange, options, scrollToIndex],
  );

  const handleScroll = useCallback(
    (event: any) => {
      updateFromOffset(event.nativeEvent.contentOffset.y);
    },
    [updateFromOffset],
  );

  const handleItemPress = useCallback(
    (index: number) => {
      const middleCopyIndex = options.length + index;
      onChange(options[index]);
      scrollToIndex(middleCopyIndex, true);
    },
    [onChange, options, scrollToIndex],
  );

  return (
    <View
      style={[
        styles.wheelColumn,
        { width, height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.wheelScroll}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        scrollEventThrottle={16}
      >
        {repeatedOptions.map((option, index) => {
          const isSelected =
            options.length > 0 && index % options.length === selectedIndex;

          return (
            <TouchableOpacity
              key={`${option}-${index}`}
              style={styles.wheelItem}
              onPress={() => handleItemPress(index % options.length)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  isSelected && styles.wheelItemTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View pointerEvents="none" style={styles.wheelSelectionFrame} />
    </View>
  );
}

export function TimePickerModal({ open, value, onCancel, onConfirm }: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const seed = useMemo(() => toParts(value), [value]);
  const [selectedHour, setSelectedHour] = useState(seed.hour);
  const [selectedMinute, setSelectedMinute] = useState(seed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(seed.period);

  useEffect(() => {
    if (!open) return;
    const parts = toParts(value);
    setSelectedHour(parts.hour);
    setSelectedMinute(parts.minute);
    setSelectedPeriod(parts.period);
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
        // capture touches so background content doesn't scroll while modal is open
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Select Time</Text>

          <View style={styles.pickerWrap}>
            <WheelColumn
              options={HOUR_OPTIONS}
              value={selectedHour}
              onChange={setSelectedHour}
              width={isCompact ? 62 : WHEEL_COLUMN_WIDTH}
            />

            <Text style={styles.separator}>:</Text>

            <WheelColumn
              options={MINUTE_OPTIONS}
              value={selectedMinute}
              onChange={setSelectedMinute}
              width={isCompact ? 62 : WHEEL_COLUMN_WIDTH}
            />

            <WheelColumn
              options={PERIOD_OPTIONS}
              value={selectedPeriod}
              onChange={(value) => setSelectedPeriod(value as Period)}
              width={isCompact ? 52 : PERIOD_COLUMN_WIDTH}
            />
          </View>

          <View style={styles.tipRow}>
            <MaterialIcons name="wb-sunny" size={18} color="#5D49CF" />
            <Text style={styles.tipText}>
              It&apos;s recommended to take medicine at the same time each day.
            </Text>
          </View>

          <View
            style={[styles.actionsRow, isCompact && styles.actionsRowCompact]}
          >
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
    maxHeight: "76%",
    alignSelf: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  pickerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F2FB",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginTop: 6,
    gap: 4,
  },
  wheelColumn: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    flexShrink: 1,
    minWidth: 54,
  },
  wheelScroll: {
    flex: 1,
    minWidth: 48,
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING_VERTICAL,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#9AA0AE",
    letterSpacing: 0.2,
  },
  wheelItemTextSelected: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 22,
  },
  wheelSelectionFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_ITEM_HEIGHT * 2,
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(61, 70, 91, 0.2)",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  separator: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A4F5E",
    paddingHorizontal: 4,
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
    fontSize: 11,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionsRowCompact: {
    flexDirection: "column",
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
