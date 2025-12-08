import { supabase } from '@/lib/supabase';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo =
        Platform.OS === 'web'
          ? `${window.location.origin}/auth/callback`
          : AuthSession.makeRedirectUri({
              scheme: 'budgetbook',
              path: 'auth/callback',
              useProxy: true, // 네이티브/Expo Go 프록시
              preferLocalhost: false,
            });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS === 'web' ? false : true,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url && Platform.OS !== 'web') {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          router.replace('/auth/callback');
        }
      }
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message ?? '구글 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">BudgetBook</Text>
        <Text className="text-gray-500 mb-8">구글 계정으로 로그인하고 가계부를 시작하세요.</Text>

        <TouchableOpacity
          onPress={signInWithGoogle}
          disabled={loading}
          className="bg-blue-500 rounded-lg py-4 items-center justify-center"
        >
          <Text className="text-white font-semibold text-lg">{loading ? '로그인 중...' : 'Google로 계속하기'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

