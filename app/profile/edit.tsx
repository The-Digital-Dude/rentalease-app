import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import {
  getProfile,
  ProfileUpdateData,
  TechnicianProfile,
  updateProfile,
  updateProfileImage,
} from "../../services/profile";
import { InputField, PrimaryButton } from "../../components/UI";

function buildFullAddress(address: {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}) {
  const street = (address.street || "").trim();
  const suburb = (address.suburb || "").trim();
  const state = (address.state || "").trim();
  const postcode = (address.postcode || "").trim();

  const parts: string[] = [];
  if (street) parts.push(street);
  const locality = [suburb, state, postcode].filter(Boolean).join(" ");
  if (locality) parts.push(locality);
  return parts.join(", ");
}

function getInitials(firstName?: string, lastName?: string, fallback?: string) {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  const fromNames = `${f} ${l}`.trim();

  const source = (fromNames || (fallback || "").trim()).trim();
  if (!source) return "T";

  const parts = source.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b) || "T";
}

export default function EditProfilePage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getProfile();
        if (!mounted) return;
        setProfile(data);

        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setPhone(data.phone || "");

        setStreet(data.address?.street || "");
        setSuburb(data.address?.suburb || "");
        setState(data.address?.state || "");
        setPostcode(data.address?.postcode || "");
        setLicenseNumber(data.licenseNumber || "");
        setLicenseExpiry(data.licenseExpiry ? String(data.licenseExpiry).split("T")[0] : "");
      } catch (e: any) {
        const message = e?.message || "Failed to load profile";
        if (message.includes("Authentication expired")) {
          Alert.alert("Session Expired", "Please login again to continue.", [
            { text: "OK", onPress: () => router.replace("/(auth)/login") },
          ]);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const avatarUrl = profile?.profileImage?.cloudinaryUrl;
  const initials = getInitials(firstName, lastName, profile?.fullName);

  const canSave = useMemo(() => {
    return !!firstName.trim() && !!lastName.trim();
  }, [firstName, lastName]);

  async function onPickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission required", "Allow photo access to upload a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingImage(true);
      const asset = result.assets[0];
      const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";

      const updated = await updateProfileImage({
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });
      setProfile(updated);
      Alert.alert("Success", "Profile image updated.");
    } catch (e: any) {
      const message = e?.message || "Failed to upload profile image";
      if (message.includes("Authentication expired")) {
        Alert.alert("Session Expired", "Please login again to continue.", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
      } else {
        Alert.alert("Upload failed", message);
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function onSave() {
    if (!canSave) {
      Alert.alert("Missing details", "First name and last name are required.");
      return;
    }
    try {
      setSaving(true);

      const next: ProfileUpdateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: {
          street: street.trim(),
          suburb: suburb.trim(),
          state: state.trim(),
          postcode: postcode.trim(),
          fullAddress: buildFullAddress({ street, suburb, state, postcode }),
        },
        licenseNumber: licenseNumber.trim() || undefined,
        licenseExpiry: licenseExpiry || undefined,
      };

      const updated = await updateProfile(next);
      setProfile(updated);
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const message = e?.message || "Failed to update profile";
      if (message.includes("Authentication expired")) {
        Alert.alert("Session Expired", "Please login again to continue.", [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
      } else {
        Alert.alert("Save failed", message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  const spacedInputStyle = { marginBottom: 16 };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "Edit Profile",
          headerStyle: { backgroundColor: theme.surface },
          headerTitleStyle: { color: theme.text, fontWeight: "700" },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={theme.primary}
              />
              <Text style={{ color: theme.primary, fontWeight: "700", marginLeft: 2 }}>
                Back
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.initialsAvatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.initialsText}>{initials}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.imageButton, { backgroundColor: theme.primary }]}
                onPress={onPickImage}
                disabled={uploadingImage}
                activeOpacity={0.8}
              >
                {uploadingImage ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera" size={18} color="white" />
                    <Text style={styles.imageButtonText}>Change Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic</Text>
            <InputField
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              style={spacedInputStyle}
            />
            <InputField
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              style={spacedInputStyle}
            />
            <InputField
              placeholder="Phone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={spacedInputStyle}
            />
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Address</Text>
            <InputField
              placeholder="Street"
              value={street}
              onChangeText={setStreet}
              style={spacedInputStyle}
            />
            <InputField
              placeholder="Suburb"
              value={suburb}
              onChangeText={setSuburb}
              style={spacedInputStyle}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <InputField
                  placeholder="State"
                  value={state}
                  onChangeText={setState}
                  style={spacedInputStyle}
                />
              </View>
              <View style={styles.half}>
                <InputField
                  placeholder="Postcode"
                  keyboardType="number-pad"
                  value={postcode}
                  onChangeText={setPostcode}
                  style={spacedInputStyle}
                />
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Credentials</Text>
            <InputField
              placeholder="License Number"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              style={spacedInputStyle}
            />
            <InputField
              placeholder="License Expiry (YYYY-MM-DD)"
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
              style={spacedInputStyle}
            />
          </View>

          <PrimaryButton
            title={saving ? "Saving..." : "Save Changes"}
            onPress={onSave}
            loading={saving}
            disabled={!canSave || saving || uploadingImage}
            style={{ marginTop: 6 }}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving || uploadingImage}
          >
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 16 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  initialsAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "white",
    fontWeight: "800",
    fontSize: 20,
    letterSpacing: 0.5,
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  imageButtonText: {
    color: "white",
    fontWeight: "700",
  },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  cancelButton: { paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "600" },
});
