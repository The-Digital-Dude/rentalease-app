import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";

const SUPPORT_EMAIL = "info@rentalease.com.au";
const SUPPORT_PHONE = "03 5906 7723";

export default function HelpPage() {
  const { theme, isDark } = useTheme();

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  const openPhone = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Help & Support",
          headerShown: true,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.primary,
          headerTitleStyle: {
            color: theme.text,
            fontWeight: "700",
          },
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.card,
              borderColor: isDark ? theme.primary + "40" : theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: isDark ? theme.primary + "20" : "#E0F2FE" },
            ]}
          >
            <MaterialCommunityIcons
              name="headset"
              size={28}
              color={theme.primary}
            />
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>
            Technician Support
          </Text>
          <Text style={[styles.heroText, { color: theme.textSecondary }]}>
            Contact RentalEase support if you need help with a job, report
            submission, account access, or schedule coordination.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="email-outline"
              size={22}
              color={theme.primary}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Email Support
            </Text>
          </View>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            Send questions, job concerns, or account issues to our support team.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={openEmail}
          >
            <MaterialCommunityIcons name="email" size={18} color="white" />
            <Text style={styles.actionButtonText}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="phone-outline"
              size={22}
              color={theme.primary}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Call Support
            </Text>
          </View>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            For urgent coordination issues, call the RentalEase team directly.
          </Text>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { borderColor: theme.primary, backgroundColor: theme.surface },
            ]}
            onPress={openPhone}
          >
            <MaterialCommunityIcons name="phone" size={18} color={theme.primary} />
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
              {SUPPORT_PHONE}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={22}
              color={theme.primary}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              When to contact us
            </Text>
          </View>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>
            • A job is blocked and you need scheduling help
          </Text>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>
            • You cannot submit an inspection or upload report media
          </Text>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>
            • Property or tenant details look incorrect
          </Text>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>
            • You are having trouble logging in or accessing the app
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 18,
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  actionButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
});
