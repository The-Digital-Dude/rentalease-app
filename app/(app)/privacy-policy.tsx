import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useTheme, Theme } from "../../contexts/ThemeContext";
import { TECHNICIAN_PAYMENTS_ENABLED } from "../../config/features";

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last Updated: January 3, 2026</Text>

        <Text style={styles.sectionTitle}>Introduction</Text>
        <Text style={styles.paragraph}>
          RentalEase Technician ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
        </Text>

        <Text style={styles.sectionTitle}>Information We Collect</Text>

        <Text style={styles.subsectionTitle}>Personal Information You Provide</Text>
        <Text style={styles.paragraph}>
          When you register and use the app, we collect:
        </Text>
        <Text style={styles.bulletPoint}>• Account Information: Full name, email address, phone number</Text>
        <Text style={styles.bulletPoint}>• Professional Information: License number, expiry date, experience</Text>
        <Text style={styles.bulletPoint}>• Location Information: Address, suburb, state, postcode</Text>
        <Text style={styles.bulletPoint}>• Profile Information: Profile photo (optional)</Text>

        <Text style={styles.subsectionTitle}>Permissions We Request</Text>
        <Text style={styles.paragraph}>
          The app requests the following permissions:
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Calendar Access:</Text> To sync your assigned job schedules and set reminders
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Camera Access:</Text> To take photos during property inspections
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Photo Library Access:</Text> To attach existing photos to inspection reports
        </Text>
        <Text style={styles.note}>
          You can deny or revoke these permissions at any time through your device settings.
        </Text>

        <Text style={styles.sectionTitle}>How We Use Your Information</Text>
        <Text style={styles.paragraph}>We use your information to:</Text>
        <Text style={styles.bulletPoint}>• Create and manage your technician account</Text>
        <Text style={styles.bulletPoint}>• Assign jobs and facilitate property maintenance services</Text>
        <Text style={styles.bulletPoint}>• Send job notifications and important updates</Text>
        <Text style={styles.bulletPoint}>• Sync your work schedule with your device calendar</Text>
        <Text style={styles.bulletPoint}>• Store inspection photos and job completion records</Text>
        {TECHNICIAN_PAYMENTS_ENABLED && (
          <Text style={styles.bulletPoint}>• Process payments for completed jobs</Text>
        )}
        <Text style={styles.bulletPoint}>• Improve app functionality and user experience</Text>

        <Text style={styles.sectionTitle}>How We Share Your Information</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>We do not sell your personal information.</Text> We may share your information with:
        </Text>

        <Text style={styles.subsectionTitle}>Service Providers</Text>
        <Text style={styles.bulletPoint}>• Cloudinary: For secure storage of photos</Text>
        <Text style={styles.bulletPoint}>• MongoDB Atlas: For encrypted database storage</Text>
        <Text style={styles.bulletPoint}>• Cloud hosting: For app infrastructure</Text>

        <Text style={styles.subsectionTitle}>Property Managers & Agencies</Text>
        <Text style={styles.paragraph}>
          Your name, contact information, and professional credentials are shared with property managers who assign you jobs. Inspection photos and completion reports are shared with the requesting property manager.
        </Text>

        <Text style={styles.sectionTitle}>Data Storage and Security</Text>
        <Text style={styles.paragraph}>We protect your data through:</Text>
        <Text style={styles.bulletPoint}>• HTTPS/TLS encryption for all data transmission</Text>
        <Text style={styles.bulletPoint}>• Encryption of sensitive data stored on our servers</Text>
        <Text style={styles.bulletPoint}>• Secure token storage using iOS Keychain</Text>
        <Text style={styles.bulletPoint}>• Strict access controls</Text>
        <Text style={styles.bulletPoint}>• Regular security audits</Text>

        <Text style={styles.sectionTitle}>Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain your information while your account is active. Job records and inspection photos are retained for 7 years for legal compliance. If you request account deletion, we will delete or anonymize your personal information within 30 days.
        </Text>

        <Text style={styles.sectionTitle}>Your Privacy Rights</Text>
        <Text style={styles.paragraph}>You have the right to:</Text>
        <Text style={styles.bulletPoint}>• Access and correct your personal information</Text>
        <Text style={styles.bulletPoint}>• Request a copy of your data in a portable format</Text>
        <Text style={styles.bulletPoint}>• Request deletion of your account and data</Text>
        <Text style={styles.bulletPoint}>• Withdraw consent for specific data processing</Text>
        <Text style={styles.bulletPoint}>• Opt out of non-essential communications</Text>

        <Text style={styles.sectionTitle}>Analytics and Tracking</Text>
        <Text style={styles.paragraph}>
          The RentalEase Technician app does <Text style={styles.bold}>not</Text> currently use any third-party analytics, advertising, or tracking services. We do not track your activity across other apps or websites.
        </Text>

        <Text style={styles.sectionTitle}>Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last Updated" date.
        </Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or concerns about this Privacy Policy, please contact us:
        </Text>
        <Text style={styles.contactInfo}>
          Email: info@rentalease.com.au
        </Text>
        <Text style={styles.contactInfo}>
          Response time: Up to 30 days
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using the RentalEase Technician app, you consent to this Privacy Policy.
          </Text>
        </View>

        <View style={styles.compliance}>
          <Text style={styles.complianceTitle}>This Privacy Policy complies with:</Text>
          <Text style={styles.complianceItem}>• Australian Privacy Principles (APPs)</Text>
          <Text style={styles.complianceItem}>• Apple App Store Review Guidelines</Text>
          <Text style={styles.complianceItem}>• California Consumer Privacy Act (CCPA)</Text>
          <Text style={styles.complianceItem}>• General Data Protection Regulation (GDPR)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.text,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.text,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 12,
    paddingLeft: 8,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.primary,
    marginBottom: 8,
  },
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: theme.primaryLight + '20',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.text,
    fontStyle: 'italic',
  },
  compliance: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  complianceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  complianceItem: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSecondary,
    marginBottom: 4,
  },
});
