import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";

export async function getToken(): Promise<string | null> {
  try {
    // On web, use localStorage instead of SecureStore
    if (Platform.OS === "web") {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.log("[getToken] Error retrieving token:", error);
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    // On web, use localStorage instead of SecureStore
    if (Platform.OS === "web") {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
      }
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.log("[setToken] Error storing token:", error);
    throw error;
  }
}

// Backwards-compatible alias used in UI
export const saveToken = setToken;

export async function deleteToken(): Promise<void> {
  try {
    // On web, use localStorage instead of SecureStore
    if (Platform.OS === "web") {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.log("[deleteToken] Error deleting token:", error);
    throw error;
  }
}