import { Redirect } from "expo-router";

import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 bg-blue-500 items-center justify-center">
        <Text className="text-white text-3xl font-bold mb-2">BudgetBook</Text>
        <Text className="text-white/80 mb-4">가계부를 준비하는 중...</Text>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!session) {
    console.log("session is null");
    return (
      <Redirect href="/login" />
    );
  }

  return (
    <Redirect href="/(tabs)" />
  );
}
