import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { DecorativeBackground } from "../../components/decorative-background";
import { auth } from "../../firebaseConfig";

export default function SignupScreen() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await updateProfile(userCredential.user, { displayName: name.trim() });
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
        <Text style={[styles.title, { color: theme.text }]}>Sign Up</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Create your account to manage reminders, logs, and progress.
        </Text>

        <TextInput
          placeholder="Name"
          placeholderTextColor={theme.textMuted}
          value={name}
          onChangeText={setName}
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

        <TextInput
          placeholder="Confirm Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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
          onPress={handleSignup}
        >
          <Text style={[styles.buttonText, { color: theme.surface }]}>
            Create Account
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push("/login")} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>
            Already have an account?{" "}
          </Text>
          <Text style={[styles.linkAction, { color: theme.primary }]}>
            Login
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
