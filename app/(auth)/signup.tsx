import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";

import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { DecorativeBackground } from "../../components/decorative-background";
import { auth } from "../../firebaseConfig";

export default function SignupScreen() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const logoSource = require("../../assets/images/CureMate_logo.png");

  const { width } = useWindowDimensions();
  const logoWidth = Math.min(Math.round(width * 0.7), 340);
  const logoHeight = Math.round(logoWidth * 0.4667);
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = () => {
      Animated.timing(logoScale, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };
    const onHide = () => {
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [logoScale]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <DecorativeBackground theme={theme} currentTheme={currentTheme} />
        <View style={styles.logoWrap}>
          <Animated.Image
            source={logoSource}
            style={[
              styles.logo,
              {
                width: logoWidth,
                height: logoHeight,
                borderRadius: Math.round(logoWidth * 0.086),
                transform: [{ scale: logoScale }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              marginTop: Math.max(24, Math.round(logoHeight / 2)),
            },
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

          <View style={styles.inputRow}>
            <TextInput
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                {
                  paddingRight: 44,
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons
                name={showPassword ? "eye-off" : "eye"}
                size={22}
                color={theme.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={[
                styles.input,
                {
                  paddingRight: 44,
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              onPress={() => setShowConfirmPassword((s) => !s)}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={22}
                color={theme.textMuted}
              />
            </Pressable>
          </View>

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

          <Pressable
            onPress={() => router.push("/login")}
            style={styles.linkRow}
          >
            <Text style={[styles.linkText, { color: theme.textSecondary }]}>
              Already have an account?{" "}
            </Text>
            <Text style={[styles.linkAction, { color: theme.primary }]}>
              Login
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center" },
  logoWrap: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  logo: {
    width: 300,
    height: 140,
    borderRadius: 26,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    marginTop: 120,
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    fontSize: 15,
  },
  inputRow: {
    position: "relative",
  },
  iconButton: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 10,
    padding: 6,
  },
  button: {
    padding: 12,
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
