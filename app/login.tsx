import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (
      !email.trim() ||
      !password.trim() ||
      (mode === "signup" && !nickname.trim())
    ) {
      setErrorMessage("이메일, 비밀번호, 닉네임을 모두 입력해주세요.");
      Alert.alert("입력 필요", "이메일, 비밀번호, 닉네임을 모두 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      setLoading(true);
      if (mode === "login") {
        await signIn(email.trim(), password.trim());
      } else {
        await signUp(email.trim(), password.trim(), nickname.trim());
        Alert.alert(
          "✅ 회원가입 완료!",
          "입력하신 이메일로 인증 메일이 발송되었습니다.\n\n메일함을 확인하여 인증 링크를 클릭한 후 위에서 로그인해주세요.\n\n💡 팁: 스팸 폴더도 확인해주세요!"
        );
        setMode("login");
        setEmail("");
        setPassword("");
        setNickname("");
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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 10}
    >
      <ScrollView
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
                value={email}
                onChangeText={setEmail}
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
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="별명을 입력하세요"
                  className="border border-gray-300 rounded-lg px-4 py-3"
                />
              </View>
            )}

            <View>
              <Text className="text-gray-700 mb-1">비밀번호</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
                className="border border-gray-300 rounded-lg px-4 py-3"
              />
            </View>
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
