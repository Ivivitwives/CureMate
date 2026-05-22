import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { DecorativeBackground } from "../components/decorative-background";

export default function ModalScreen() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <ThemedView
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText type="title" style={{ color: theme.text }}>
          This is a modal
        </ThemedText>
        <ThemedText
          style={{
            color: theme.textSecondary,
            marginTop: 10,
            textAlign: "center",
          }}
        >
          The app is now following the active light or dark palette.
        </ThemedText>
        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <ThemedText
            type="link"
            style={{ color: theme.surface, fontWeight: "700" }}
          >
            Go to home screen
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
