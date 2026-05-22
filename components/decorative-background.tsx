import { StyleSheet, View } from "react-native";
import { Colors } from "../constants/theme";

type ThemeColors = (typeof Colors)[keyof typeof Colors];

type DecorativeBackgroundProps = {
  theme: ThemeColors;
  currentTheme: keyof typeof Colors;
};

const blobStyle = (
  theme: ThemeColors,
  currentTheme: keyof typeof Colors,
  top: number,
  left: number,
  size: number,
) => ({
  backgroundColor: theme.primary,
  opacity: currentTheme === "dark" ? 0.14 : 0.08,
  height: size,
  width: size,
  top,
  left,
});

export function DecorativeBackground({
  theme,
  currentTheme,
}: DecorativeBackgroundProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View
        style={[styles.blob, blobStyle(theme, currentTheme, -48, -20, 140)]}
      />
      <View
        style={[styles.blob, blobStyle(theme, currentTheme, 120, -70, 180)]}
      />
      <View
        style={[
          styles.blob,
          {
            backgroundColor: theme.primary,
            opacity: currentTheme === "dark" ? 0.12 : 0.06,
            height: 220,
            width: 220,
            top: 40,
            right: -90,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
});
