import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { ScreenDataCacheProvider } from "@/hooks/use-screen-data-cache";
import { ThemeProvider, useThemeContext } from "@/hooks/use-theme-context";
import { auth } from "../firebaseConfig";
import { checkAndResetDay } from "../services/schedule";

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const inScheduleScreen = segments[0] === "schedule";
    const inMedicineScreens =
      segments[0] === "medicine" || segments[0] === "editMeds";
    const inTermsScreen = segments[0] === "termOfService";

    if (!user && !inAuthGroup && !inTermsScreen) {
      router.replace("/(auth)/login");
      return;
    }

    if (
      user &&
      !inTabsGroup &&
      !inScheduleScreen &&
      !inMedicineScreens &&
      !inTermsScreen
    ) {
      // When user logs in, check and reset daily logs
      checkAndResetDay().catch(console.error);
      router.replace("/(tabs)");
    }
  }, [router, segments, user]);

  if (user === undefined) {
    return null;
  }

  return children;
}

function RootLayoutInner() {
  const { theme } = useThemeContext();
  const themeObj = Colors[theme];

  return (
    <NavThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
      <ScreenDataCacheProvider>
        <AuthGate>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="schedule" options={{ headerShown: false }} />
            <Stack.Screen name="medicine" options={{ headerShown: false }} />
            <Stack.Screen name="editMeds" options={{ headerShown: false }} />
            <Stack.Screen
              name="termOfService"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
        </AuthGate>
      </ScreenDataCacheProvider>
      <StatusBar
        style={theme === "dark" ? "light" : "dark"}
        backgroundColor={themeObj.background}
      />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
