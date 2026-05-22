import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";

export default function TabLayout() {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: 78,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={22} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={22} name="assessment" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "",
          tabBarIcon: () => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.primary,
                justifyContent: "center",
                alignItems: "center",
                marginTop: -8,
                shadowColor: "#000",
                shadowOpacity: currentTheme === "dark" ? 0.3 : 0.12,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 14,
                elevation: 6,
              }}
            >
              <MaterialIcons size={28} name="add" color={theme.surface} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={22} name="history" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={22} name="person" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
