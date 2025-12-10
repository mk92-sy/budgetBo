import { supabase } from "@/lib/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Alert, Button, ScrollView, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  useEffect(() => {
    const handleDeepLink = async (event: Linking.EventType) => {
      const url = event.url;
      
      if (url.includes('#access_token=')) {
        const hashPart = url.split('#')[1];
        const params = new URLSearchParams(hashPart);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (access_token && refresh_token) {
          try {
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            router.replace('/(tabs)');
          } catch (error) {
            console.error('Session error:', error);
            Alert.alert('로그인 실패', '세션 설정 중 오류가 발생했습니다.');
          }
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function signInWithGoogle() {
    try {
      // 🔥 수정 1: redirectUrl 생성 방식 변경
      const redirectUrl = makeRedirectUri({
        scheme: "budgetbook",
        // path 제거 또는 간단하게
      });

      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          // 🔥 수정 2: skipBrowserRedirect 제거 (false로 설정)
          // skipBrowserRedirect: true, // 이 줄 제거
        },
      });

      if (error) throw error;

      if (data.url) {
        // 🔥 수정 3: WebBrowser.openAuthSessionAsync 사용
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        console.log('Browser result:', result);

        if (result.type === "success" && result.url) {
          // Deep link 리스너가 자동으로 처리하므로
          // 여기서는 추가 처리 불필요
          // handleDeepLink가 자동으로 호출됨
        } else if (result.type === "cancel") {
          Alert.alert('로그인 취소', '로그인이 취소되었습니다.');
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert('로그인 오류', error.message || '다시 시도해주세요.');
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          BudgetBook
        </Text>
        <Text className="text-gray-500 mb-8">
          구글 계정으로 로그인하고 가계부를 시작하세요.
        </Text>

        <Button title="Google로 로그인" onPress={signInWithGoogle} />
      </View>
    </ScrollView>
  );
}