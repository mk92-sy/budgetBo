import { useAuth } from "@/hooks/useAuth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { signIn, signUp, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Separate state for login and signup so inputs don't share values
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupNickname, setSignupNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadRemember = async () => {
      try {
        const rm = await AsyncStorage.getItem('bb_remember_me');
        const em = await AsyncStorage.getItem('bb_remember_email');
        if (rm === 'true') {
          setRememberMe(true);
          if (em) setLoginEmail(em);
        }
      } catch {
        // ignore
      }
    };
    loadRemember();

    // Ensure Android navigation bar matches app background to avoid visible black area
    (async () => {
      try {
        await NavigationBar.setBackgroundColorAsync('#ffffff');
        await NavigationBar.setButtonStyleAsync('dark');
      } catch {
        // ignore if unavailable
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (mode === "login") {
      if (!loginEmail.trim() || !loginPassword.trim()) {
        setErrorMessage("이메일과 비밀번호를 입력해주세요.");
        Alert.alert("입력 필요", "이메일과 비밀번호를 입력해주세요.");
        return;
      }
    } else {
      if (!signupEmail.trim() || !signupPassword.trim() || !signupNickname.trim() || !signupPasswordConfirm.trim()) {
        setErrorMessage("이메일, 비밀번호, 비밀번호 확인, 닉네임을 모두 입력해주세요.");
        Alert.alert("입력 필요", "이메일, 비밀번호, 비밀번호 확인, 닉네임을 모두 입력해주세요.");
        return;
      }

      if (signupPassword !== signupPasswordConfirm) {
        setErrorMessage("비밀번호가 일치하지 않습니다.");
        Alert.alert("비밀번호 불일치", "비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        return;
      }
    }

    try {
      setErrorMessage(null);
      setLoading(true);
      if (mode === "login") {
        await signIn(loginEmail.trim(), loginPassword.trim());
        // persist remember-me flag (no credentials are stored)
        if (rememberMe) {
          await AsyncStorage.setItem('bb_remember_me', 'true');
          await AsyncStorage.setItem('bb_remember_email', loginEmail.trim());
        } else {
          await AsyncStorage.removeItem('bb_remember_me');
          await AsyncStorage.removeItem('bb_remember_email');
        }
      } else {
        await signUp(signupEmail.trim(), signupPassword.trim(), signupNickname.trim());
        Alert.alert(
          "✅ 회원가입 완료!",
          "회원가입이 완료되었습니다. 로그인하여 시작하세요."
        );
        setMode("login");
        // clear signup inputs
        setSignupEmail("");
        setSignupPassword("");
        setSignupPasswordConfirm("");
        setSignupNickname("");
      }
    } catch (error: any) {
      const errorMsg =
        error.message || "로그인/회원가입 중 오류가 발생했습니다.";
      console.error("Auth error:", error);
      setErrorMessage(errorMsg);
      Alert.alert("오류", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 10}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#fff' }}
        className="flex-1 bg-white"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            BudgetBook
          </Text>
          <Text className="text-gray-500 mb-8">
            이메일로 로그인하거나, 로그인 없이 바로 시작할 수 있습니다.
          </Text>

          <View className="flex-row mb-4 bg-gray-100 rounded-lg p-1">
            <TouchableOpacity
              onPress={() => setMode("login")}
              className={`flex-1 py-3 rounded-md ${
                mode === "login" ? "bg-blue-500" : ""
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  mode === "login" ? "text-white" : "text-gray-700"
                }`}
              >
                로그인
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("signup")}
              className={`flex-1 py-3 rounded-md ${
                mode === "signup" ? "bg-blue-500" : ""
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  mode === "signup" ? "text-white" : "text-gray-700"
                }`}
              >
                회원가입
              </Text>
            </TouchableOpacity>
          </View>

          <View className="gap-3 mb-4">
            <View>
              <Text className="text-gray-700 mb-1">이메일</Text>
              <TextInput
                value={mode === 'login' ? loginEmail : signupEmail}
                onChangeText={mode === 'login' ? setLoginEmail : setSignupEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="border border-gray-300 rounded-lg px-4 py-3"
              />
            </View>

            {mode === "signup" && (
              <View>
                <Text className="text-gray-700 mb-1">닉네임</Text>
                <TextInput
                  value={signupNickname}
                  onChangeText={setSignupNickname}
                  placeholder="별명을 입력하세요"
                  className="border border-gray-300 rounded-lg px-4 py-3"
                />
              </View>
            )}

            <View>
              <Text className="text-gray-700 mb-1">비밀번호</Text>
              <TextInput
                value={mode === 'login' ? loginPassword : signupPassword}
                onChangeText={mode === 'login' ? setLoginPassword : setSignupPassword}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
                className="border border-gray-300 rounded-lg px-4 py-3"
              />
            </View>

            {mode === 'signup' && (
              <View>
                <Text className="text-gray-700 mb-1">비밀번호 확인</Text>
                <TextInput
                  value={signupPasswordConfirm}
                  onChangeText={setSignupPasswordConfirm}
                  placeholder="비밀번호를 다시 입력하세요"
                  secureTextEntry
                  className="border border-gray-300 rounded-lg px-4 py-3"
                />
              </View>
            )}

            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                className="flex-row items-center mt-1"
              >
                <View className={`w-5 h-5 mr-2 rounded-sm border ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                  {rememberMe && (
                    <Text className="text-white text-xs text-center">✓</Text>
                  )}
                </View>
                <Text className="text-gray-700">자동로그인</Text>
              </TouchableOpacity>
            )}
          </View>

          {errorMessage && (
            <View className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-700 font-semibold text-base">
                {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`bg-blue-500 py-4 rounded-lg mb-3 ${
              loading ? "opacity-70" : ""
            }`}
          >
            <Text className="text-white text-center font-bold text-lg">
              {loading
                ? "처리 중..."
                : mode === "login"
                ? "로그인"
                : "회원가입"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGuest}
            className="py-3 rounded-lg border border-gray-300"
          >
            <Text className="text-center font-semibold text-gray-700">
              로그인 없이 진행하기
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
