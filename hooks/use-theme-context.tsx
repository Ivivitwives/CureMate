import { useColorScheme as useSystemColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeContextType = {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  isSystem: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [manualOverride, setManualOverride] = useState<"light" | "dark" | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("@app_theme_preference");
        if (saved === "light" || saved === "dark") {
          setManualOverride(saved);
          setThemeState(saved);
        } else {
          // Use system theme if no preference saved
          setThemeState(systemTheme === "dark" ? "dark" : "light");
        }
      } catch (e) {
        console.warn("Error loading theme preference:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Update theme when system preference changes (only if no manual override)
  useEffect(() => {
    if (manualOverride === null && systemTheme) {
      setThemeState(systemTheme === "dark" ? "dark" : "light");
    }
  }, [systemTheme, manualOverride]);

  const handleSetTheme = async (newTheme: "light" | "dark" | "system") => {
    try {
      console.log(`[ThemeContext] handleSetTheme called with:`, newTheme);
      if (newTheme === "system") {
        // Clear manual override and use system theme
        setManualOverride(null);
        setThemeState(systemTheme === "dark" ? "dark" : "light");
        void AsyncStorage.removeItem("@app_theme_preference");
        console.log(`[ThemeContext] Set to system theme`);
      } else {
        // Set manual override
        setManualOverride(newTheme);
        setThemeState(newTheme);
        void AsyncStorage.setItem("@app_theme_preference", newTheme);
        console.log(`[ThemeContext] Set to ${newTheme} theme`);
      }
    } catch (e) {
      console.warn("Error saving theme preference:", e);
    }
  };

  const value: ThemeContextType = {
    theme,
    setTheme: handleSetTheme,
    isSystem: manualOverride === null,
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return context;
}
