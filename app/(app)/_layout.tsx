import { Tabs } from "expo-router";
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { registerForPushNotificationsIfPossible, sendPushTokenToBackend } from "../../services/pushNotifications";
import { TECHNICIAN_PAYMENTS_ENABLED } from "../../config/features";

export default function AppLayout() {
  const { theme } = useTheme();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const expoToken = await registerForPushNotificationsIfPossible();
        if (!expoToken || cancelled) return;
        await sendPushTokenToBackend(expoToken);
      } catch (e) {
        console.log("[Push] Registration skipped/failed:", (e as any)?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 0,
          height: 90,
          paddingBottom: 25,
          paddingTop: 10,
          paddingHorizontal: 0,
          position: "absolute",
          ...Platform.select({
            ios: {
              shadowColor: theme.shadow,
              shadowOffset: {
                width: 0,
                height: -2,
              },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          paddingHorizontal: 2,
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Available Jobs",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "briefcase" : "briefcase-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{
          title: "My Jobs",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "clipboard-check" : "clipboard-check-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: TECHNICIAN_PAYMENTS_ENABLED ? undefined : null,
          title: "Payments",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "wallet" : "wallet-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
