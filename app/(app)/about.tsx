import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useTheme, Theme } from "../../contexts/ThemeContext";

const APP_VERSION = Constants.expoConfig?.version ?? "—";
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  (Constants.expoConfig as any)?.android?.versionCode?.toString() ??
  "—";
const SUPPORT_EMAIL = "support@rentalease.com.au";

export default function AboutPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [checking, setChecking] = useState(false);

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update Ready",
          "A new update has been downloaded. The app will restart now.",
          [{ text: "OK", onPress: () => Updates.reloadAsync() }]
        );
      } else {
        Alert.alert("Up to Date", "You are running the latest version.");
      }
    } catch {
      Alert.alert("Update Check Failed", "Could not check for updates. Please try again later.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="wrench" size={40} color={theme.primary} />
          </View>
          <Text style={styles.appName}>RentalEase Technician</Text>
          <Text style={styles.versionLabel}>
            Version {APP_VERSION} (Build {BUILD_NUMBER})
          </Text>
        </View>

        <View style={styles.card}>
          <Row icon="update" label="Version" value={APP_VERSION} theme={theme} styles={styles} />
          <Divider theme={theme} />
          <Row icon="hammer-screwdriver" label="Build" value={BUILD_NUMBER} theme={theme} styles={styles} />
          <Divider theme={theme} />
          <Row icon="briefcase-outline" label="Company" value="RentalEase Pty Ltd" theme={theme} styles={styles} />
        </View>

        <TouchableOpacity
          style={[styles.card, styles.actionRow]}
          onPress={handleCheckUpdates}
          disabled={checking}
        >
          <MaterialCommunityIcons name="cloud-download-outline" size={20} color={theme.primary} />
          <Text style={[styles.actionLabel, { color: theme.primary }]}>Check for Updates</Text>
          {checking ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: "auto" }} />
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.textTertiary}
              style={{ marginLeft: "auto" }}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.actionRow]}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        >
          <MaterialCommunityIcons name="email-outline" size={20} color={theme.primary} />
          <Text style={[styles.actionLabel, { color: theme.primary }]}>Contact Support</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.textTertiary}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.actionRow]}
          onPress={() => router.push("/(app)/privacy-policy")}
        >
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.primary} />
          <Text style={[styles.actionLabel, { color: theme.primary }]}>Privacy Policy</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.textTertiary}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        <Text style={styles.footer}>© 2026 RentalEase Pty Ltd. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  theme,
  styles,
}: {
  icon: string;
  label: string;
  value: string;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as any} size={18} color={theme.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: Theme }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 38 }} />;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: { width: 40, alignItems: "flex-start" },
    headerTitle: { fontSize: 17, fontWeight: "600", color: theme.text },
    content: { padding: 20, paddingBottom: 60 },
    logoSection: { alignItems: "center", marginBottom: 28 },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: theme.primary + "18",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    appName: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 4 },
    versionLabel: { fontSize: 13, color: theme.textSecondary },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    rowLabel: { fontSize: 15, color: theme.text, flex: 1 },
    rowValue: { fontSize: 15, color: theme.textSecondary },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    actionLabel: { fontSize: 15, fontWeight: "500" },
    footer: {
      textAlign: "center",
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 20,
    },
  });
