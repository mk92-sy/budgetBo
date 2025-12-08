import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchange = async () => {
      const code = params.code as string | undefined;
      if (!code) {
        setError('인증 코드가 없습니다.');
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      router.replace('/(tabs)');
    };
    exchange();
  }, [params, router]);

  return (
    <View className="flex-1 bg-white items-center justify-center px-4">
      {error ? (
        <>
          <Text className="text-red-600 font-semibold mb-2">인증 실패</Text>
          <Text className="text-gray-600 text-center mb-4">{error}</Text>
          <Text className="text-blue-500" onPress={() => router.replace('/login')}>
            로그인 화면으로 돌아가기
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 mt-3">로그인 중입니다...</Text>
        </>
      )}
    </View>
  );
}

