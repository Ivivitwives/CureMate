/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#2E6AC8";
const tintColorDark = "#7DA7FF";

export const Colors = {
  light: {
    text: "#16202D",
    textSecondary: "#516071",
    textMuted: "#738198",
    background: "#F4F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#F8FAFD",
    surfaceMuted: "#EEF3F9",
    border: "#D8E0EA",
    inputBackground: "#FFFFFF",
    tint: tintColorLight,
    primary: "#4B36CC",
    primarySoft: "#EEF2FF",
    primaryBorder: "#C9D4FF",
    success: "#2A9A61",
    successSoft: "#ECFAF2",
    warning: "#D07F1F",
    warningSoft: "#FFF5E9",
    danger: "#CC4C4C",
    dangerSoft: "#FFF1F1",
    overlay: "rgba(15, 23, 42, 0.35)",
    tabBarBackground: "#FFFFFF",
    tabBarBorder: "#DCE3EE",
    icon: "#687076",
    tabIconDefault: "#738198",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F4F7FB",
    textSecondary: "#C7D0DE",
    textMuted: "#95A3B8",
    background: "#0E1522",
    surface: "#141C2B",
    surfaceAlt: "#182235",
    surfaceMuted: "#1D2A3F",
    border: "#293648",
    inputBackground: "#172133",
    tint: tintColorDark,
    primary: "#8A7CFF",
    primarySoft: "#232B45",
    primaryBorder: "#38416A",
    success: "#4AC58D",
    successSoft: "#173424",
    warning: "#F1B76A",
    warningSoft: "#3A2A18",
    danger: "#F58A8A",
    dangerSoft: "#3A1E23",
    overlay: "rgba(4, 10, 20, 0.65)",
    tabBarBackground: "#121A28",
    tabBarBorder: "#2A3648",
    icon: "#9BA1A6",
    tabIconDefault: "#A2AFBF",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
