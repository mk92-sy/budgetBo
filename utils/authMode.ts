import AsyncStorage from "@react-native-async-storage/async-storage";

export type AuthMode = "guest" | "supabase";

const AUTH_MODE_KEY = "bb_auth_mode";

export const setAuthMode = async (mode: AuthMode) => {
  await AsyncStorage.setItem(AUTH_MODE_KEY, mode);
};

export const clearAuthMode = async () => {
  await AsyncStorage.removeItem(AUTH_MODE_KEY);
};

export const getAuthMode = async (): Promise<AuthMode | null> => {
  const value = await AsyncStorage.getItem(AUTH_MODE_KEY);
  if (value === "guest" || value === "supabase") {
    return value;
  }
  return null;
};
