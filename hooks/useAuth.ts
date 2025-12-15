import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError, Session } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthMode, clearAuthMode, getAuthMode, setAuthMode } from "../utils/authMode";
import { createDefaultCategoriesForUser } from "../utils/category";

type AuthState = {
  session: Session | null;
  mode: AuthMode | null;
  loading: boolean;
};

function getAuthErrorMessage(error: AuthError): string {
  const message = error.message || "";
  
  // 이메일 확인 필요
  if (message.includes("Email not confirmed")) {
    return "📧 이메일 인증이 완료되지 않았습니다.\n\n이메일 받은편지함을 확인하여 인증 링크를 클릭해주세요.\n\n(스팸 폴더도 확인해주세요)";
  }
  
  // 잘못된 로그인 정보
  if (message.includes("Invalid login credentials")) {
    return "❌ 이메일 또는 비밀번호가 잘못되었습니다.\n\n입력하신 정보를 다시 확인해주세요.";
  }
  
  // 이미 가입된 이메일
  if (message.includes("User already registered")) {
    return "⚠️ 이미 가입된 이메일입니다.\n\n로그인 탭에서 로그인해주세요.";
  }
  
  // 약한 비밀번호
  if (message.includes("weak password")) {
    return "🔒 비밀번호가 너무 간단합니다.\n\n더 강한 비밀번호를 사용해주세요.\n(최소 6자 이상, 대소문자, 숫자 포함 권장)";
  }
  
  // 잘못된 이메일 형식
  if (message.includes("invalid email")) {
    return "✉️ 올바른 이메일 형식이 아닙니다.\n\n예: user@example.com";
  }
  
  // 네트워크 오류
  if (message.includes("Network error")) {
    return "🌐 네트워크 연결을 확인해주세요.";
  }
  
  // 기타 오류
  return message || "❌ 인증 중 오류가 발생했습니다.";
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    session: null,
    mode: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const storedMode = await getAuthMode();

      if (storedMode === "guest") {
        if (!mounted) return;
        setState({ session: null, mode: "guest", loading: false });
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setState({ session: data.session, mode: data.session ? "supabase" : null, loading: false });

      // If user previously chose 'remember me' and there is a valid session,
      // navigate straight to the main tabs (auto-login UX).
      try {
        const rm = await AsyncStorage.getItem('bb_remember_me');
        if (rm === 'true' && data.session) {
          // Redirect to the main tabs only when we are currently on a public route
          // (root, login, auth flows). If the user is already inside the app
          // (e.g., /settings), do not force a navigation which causes an undesired
          // re-render/redirect behavior.
          // Derive current path in a safe way. Avoid treating "empty/undefined" as a public route
          // because during some navigation flows pathname/asPath can be temporarily empty
          // which caused an undesired redirect back to the main tabs when moving to
          // internal routes such as settings. Be strict: only treat known public routes
          // (root or auth/login flows) as public.
          const currentPath = (router as any).pathname || (router as any).asPath || '';
          const onPublicRoute =
            currentPath === '/' ||
            currentPath === '/index' ||
            currentPath.startsWith('/login') ||
            currentPath.startsWith('/auth') ||
            currentPath.startsWith('/signup');

          if (onPublicRoute) {
            router.replace('/(tabs)');
          }
        }
      } catch (e) {
        // ignore storage errors
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        mode: session ? "supabase" : prev.mode === "guest" ? "guest" : null,
      }));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, nickname: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: nickname, nickname } },
    });
    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }
    await setAuthMode("supabase");
    setState({ session: data.session, mode: "supabase", loading: false });
    // Try to create default categories for the new user.
    try {
      const userId = (data as any)?.user?.id || data.session?.user?.id;
      await createDefaultCategoriesForUser(userId);
    } catch (e) {
      console.error('Failed to create default categories on signup:', e);
    }
    return data.session;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(getAuthErrorMessage(error));
    }
    await setAuthMode("supabase");
    setState({ session: data.session, mode: "supabase", loading: false });
    // Ensure default categories exist on user sign-in (covers email-confirm flows)
    try {
      const uid = data.session?.user?.id;
      if (uid) await createDefaultCategoriesForUser(uid);
    } catch (e) {
      console.error('Failed to create default categories on sign-in:', e);
    }
    // 로그인 성공 후 즉시 화면 전환
    router.replace("/(tabs)");
    return data.session;
  };

  const continueAsGuest = async () => {
    await setAuthMode("guest");
    await supabase.auth.signOut();
    setState({ session: null, mode: "guest", loading: false });
    // 게스트 모드 진입 후 즉시 화면 전환
    router.replace("/(tabs)");
  };

  const signOut = async () => {
    if (state.mode === "guest") {
      await clearAuthMode();
      setState({ session: null, mode: null, loading: false });
      router.replace("/login");
      return;
    }
    await supabase.auth.signOut();
    await clearAuthMode();
    setState({ session: null, mode: null, loading: false });
    router.replace("/login");
  };

  const userName =
    state.mode === "guest"
      ? "게스트"
      : state.session?.user?.user_metadata?.nickname ||
        state.session?.user?.user_metadata?.name ||
        state.session?.user?.email ||
        "사용자";

  return {
    session: state.session,
    loading: state.loading,
    isGuest: state.mode === "guest",
    userName,
    signUp,
    signIn,
    continueAsGuest,
    signOut,
  };
}
