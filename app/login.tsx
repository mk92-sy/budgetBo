import { supabase } from "@/lib/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Alert, Button, ScrollView, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  // Deep link 리스너 추가
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
            
            // 로그인 성공 후 페이지 이동
            router.replace('/(tabs)'); // 또는 원하는 경로
          } catch (error) {
            console.error('Session error:', error);
            Alert.alert('로그인 실패', '세션 설정 중 오류가 발생했습니다.');
          }
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 닫혀있다가 deep link로 열린 경우
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
      const redirectUrl = makeRedirectUri({
        scheme: "budgetbook", // 소문자로 변경 (일관성)
        path: "auth/callback" // path 추가
      });

      console.log('Redirect URL:', redirectUrl); // 디버깅용

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (error) throw error;

      if (data.url) {
        // 브라우저 세션 열기
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        console.log('Browser result:', result); // 디버깅용

        // result.type이 'success'인 경우 처리
        if (result.type === "success" && result.url) {
          const hashPart = result.url.split("#")[1];
          
          if (hashPart) {
            const params = new URLSearchParams(hashPart);
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");

            if (access_token && refresh_token) {
              await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              
              // 로그인 성공 후 페이지 이동
              router.replace('/(tabs)'); // 또는 원하는 경로
              Alert.alert('로그인 성공!');
            } else {
              Alert.alert('로그인 실패', '토큰을 가져올 수 없습니다.');
            }
          }
        } else if (result.type === "cancel") {
          Alert.alert('로그인 취소', '로그인이 취소되었습니다.');
        } else if (result.type === "dismiss") {
          console.log('Browser dismissed');
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