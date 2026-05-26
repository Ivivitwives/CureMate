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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { ScreenDataCacheProvider } from "@/hooks/use-screen-data-cache";
import { ThemeProvider, useThemeContext } from "@/hooks/use-theme-context";
import { auth } from "../firebaseConfig";
import { rescheduleTodayNotifications } from "../services/notificationService";
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
    if (!user) {
      return;
    }

    const syncReminders = async () => {
      try {
        await checkAndResetDay();
        await rescheduleTodayNotifications();
      } catch (error) {
        console.warn("Failed to sync notifications", error);
      }
    };

    void syncReminders();
  }, [user]);

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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: themeObj.background }}
        edges={["top", "bottom"]}
      >
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
      </SafeAreaView>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
