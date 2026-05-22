import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getToken } from "./secureStore";

const RAW_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;

function getBaseUrl(): string {
  if (!RAW_BASE_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_BASE_URL. Set it in .env (e.g., http://localhost:4000) and restart the dev server."
    );
  }
  try {
    const url = new URL(RAW_BASE_URL);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      if (Platform.OS === "android") {
        url.hostname = "10.0.2.2";
      } else {
        url.hostname = "127.0.0.1";
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return RAW_BASE_URL;
  }
}

function getExpoProjectId(): string | undefined {
  const expoConfig: any = (Constants as any).expoConfig;
  const easConfig: any = (Constants as any).easConfig;
  return (
    easConfig?.projectId ||
    expoConfig?.extra?.eas?.projectId ||
    expoConfig?.extra?.eas?.projectId ||
    undefined
  );
}

function logPushDebug(message: string, details?: Record<string, unknown>) {
  console.log("[PushDebug]", message, details || {});
}

export interface PushRegistrationState {
  stage:
    | "idle"
    | "permissions"
    | "channel"
    | "token"
    | "backend"
    | "success"
    | "error";
  platform: string;
  permissionStatus?: string | null;
  projectId?: string | null;
  expoPushToken?: string | null;
  tokenPreview?: string | null;
  backendRegistered?: boolean;
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastReason?: string | null;
}

let lastPushRegistrationState: PushRegistrationState = {
  stage: "idle",
  platform: Platform.OS,
  permissionStatus: null,
  projectId: getExpoProjectId() || null,
  expoPushToken: null,
  tokenPreview: null,
  backendRegistered: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastReason: null,
};

function updatePushRegistrationState(
  patch: Partial<PushRegistrationState>
): PushRegistrationState {
  lastPushRegistrationState = {
    ...lastPushRegistrationState,
    ...patch,
  };
  return lastPushRegistrationState;
}

export function getLastPushRegistrationState(): PushRegistrationState {
  return { ...lastPushRegistrationState };
}

export async function registerForPushNotificationsIfPossible(): Promise<string | null> {
  updatePushRegistrationState({
    stage: "permissions",
    platform: Platform.OS,
    projectId: getExpoProjectId() || null,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
    backendRegistered: false,
  });

  if (!Device.isDevice) {
    logPushDebug("Skipping push registration because this is not a physical device");
    updatePushRegistrationState({
      stage: "error",
      lastError: "Push notifications require a physical device",
    });
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  updatePushRegistrationState({
    permissionStatus: status,
  });
  logPushDebug("Initial notification permission status", {
    platform: Platform.OS,
    status,
    canAskAgain: permission.canAskAgain,
    granted: permission.granted,
    iosStatus: (permission as any)?.ios?.status,
    androidImportance: (permission as any)?.android?.importance,
  });

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    updatePushRegistrationState({
      permissionStatus: status,
    });
    logPushDebug("Requested notification permission", {
      platform: Platform.OS,
      status,
      canAskAgain: requested.canAskAgain,
      granted: requested.granted,
      iosStatus: (requested as any)?.ios?.status,
      androidImportance: (requested as any)?.android?.importance,
    });
  }
  if (status !== "granted") {
    logPushDebug("Push registration stopped because permission was not granted", {
      platform: Platform.OS,
      status,
    });
    updatePushRegistrationState({
      stage: "error",
      permissionStatus: status,
      lastError: `Notification permission not granted (${status})`,
    });
    return null;
  }

  if (Platform.OS === "android") {
    updatePushRegistrationState({
      stage: "channel",
    });
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#024974",
    });
    logPushDebug("Configured Android notification channel", {
      channelId: "default",
    });
  }

  const projectId = getExpoProjectId();
  updatePushRegistrationState({
    stage: "token",
    projectId: projectId || null,
  });
  logPushDebug("Resolving Expo project ID for push token", {
    platform: Platform.OS,
    projectId: projectId || null,
    deviceModel: Device.modelName || null,
    osVersion: Device.osVersion || null,
    appOwnership: Constants.appOwnership || null,
  });

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  updatePushRegistrationState({
    expoPushToken: token.data,
    tokenPreview: token.data ? `${token.data.slice(0, 24)}...` : null,
  });
  logPushDebug("Expo push token acquired", {
    platform: Platform.OS,
    tokenPreview: token.data ? `${token.data.slice(0, 24)}...` : null,
  });
  return token.data;
}

export async function sendPushTokenToBackend(expoPushToken: string): Promise<void> {
  updatePushRegistrationState({
    stage: "backend",
    expoPushToken,
    tokenPreview: `${expoPushToken.slice(0, 24)}...`,
  });
  const baseUrl = getBaseUrl();
  const token = await getToken();
  if (!token) {
    updatePushRegistrationState({
      stage: "error",
      lastError: "No auth token available for backend push registration",
    });
    return;
  }

  const payload = {
    token: expoPushToken,
    metadata: {
      platform: Platform.OS,
      deviceModel: Device.modelName || null,
      osVersion: Device.osVersion || null,
      appVersion:
        (Constants.expoConfig as any)?.version ||
        (Constants.manifest2 as any)?.extra?.expoClient?.version ||
        null,
      projectId: getExpoProjectId() || null,
    },
  };

  logPushDebug("Sending Expo push token to backend", {
    baseUrl,
    platform: payload.metadata.platform,
    tokenPreview: `${expoPushToken.slice(0, 24)}...`,
    metadata: payload.metadata,
  });

  const response = await fetch(`${baseUrl}/api/v1/technician/auth/push-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    logPushDebug("Backend push token registration failed", {
      status: response.status,
      response: data,
    });
    if (response.status === 401) {
      updatePushRegistrationState({
        stage: "error",
        backendRegistered: false,
        lastError: "Authentication expired. Please login again.",
      });
      throw new Error("Authentication expired. Please login again.");
    }
    updatePushRegistrationState({
      stage: "error",
      backendRegistered: false,
      lastError: data?.message || "Failed to register push token",
    });
    throw new Error(data?.message || "Failed to register push token");
  }

  updatePushRegistrationState({
    stage: "success",
    backendRegistered: true,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
  });
  logPushDebug("Backend push token registration succeeded", {
    tokenCount: data?.data?.tokens?.length ?? null,
    response: data,
  });
}

export async function registerAndSyncPushToken(
  reason: string = "manual"
): Promise<string | null> {
  updatePushRegistrationState({
    lastReason: reason,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  });

  try {
    const expoToken = await registerForPushNotificationsIfPossible();
    if (!expoToken) {
      return null;
    }
    await sendPushTokenToBackend(expoToken);
    return expoToken;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Push registration failed";
    updatePushRegistrationState({
      stage: "error",
      lastError: message,
    });
    throw error;
  }
}

