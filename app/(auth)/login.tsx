import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { DecorativeBackground } from "../../components/decorative-background";
import { auth } from "../../firebaseConfig";

export default function LoginScreen() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Login</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sign in to keep your medication schedule in sync.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[
            styles.input,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={[
            styles.input,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={handleLogin}
        >
          <Text style={[styles.buttonText, { color: theme.surface }]}>
            Login
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/signup")}
          style={styles.linkRow}
        >
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>
            No account?{" "}
          </Text>
          <Text style={[styles.linkAction, { color: theme.primary }]}>
            Sign up
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    padding: 15,
    borderRadius: 14,
    marginTop: 6,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  linkRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
  },
  linkText: { fontSize: 14 },
  linkAction: { fontSize: 14, fontWeight: "700" },
});
