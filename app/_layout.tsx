import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import './global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFonts } from 'expo-font';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Load Pretendard font files from assets/fonts
  const [fontsLoaded] = useFonts({
    Pretendard: require('../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.ttf'),
  });

  // If fonts are loaded, set global default fontFamily for Text and TextInput
  if (fontsLoaded) {
    try {
      // assign defaultProps for global styling using cast to any to satisfy TS
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      // preserve existing styles
      (Text as any).defaultProps.style = { ...((Text as any).defaultProps.style || {}), fontFamily: 'Pretendard' };
      (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
      (TextInput as any).defaultProps.style = { ...((TextInput as any).defaultProps.style || {}), fontFamily: 'Pretendard' };
    } catch (e) {
      // ignore in environments that don't support defaultProps
    }
  }

  // If fonts are not loaded yet, render nothing (prevents layout shift).
  // The developer must add Pretendard font files under `assets/fonts/` path.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
