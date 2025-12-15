import { HapticTab } from "@/components/haptic-tab";
import { ModalProvider, useModal } from "@/contexts/ModalContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

//icons
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

function TabsContent() {
  const colorScheme = useColorScheme();
  const { openModal } = useModal();
  const insets = useSafeAreaInsets();
  const TabsComponent: any = Tabs;
  // Slightly translucent glassy background per theme
  const glassBackground = colorScheme === 'dark' ? 'rgba(24, 28, 36, 0.8)' : 'rgba(255, 255, 255, 0.85)';
  
  return (
    <>
      <View
        style={{
          position: "absolute",
          top: insets.top === 0 ? 0 : 0,
          left: 0,
          right: 0,
          height: insets.top ?? 0,
          backgroundColor: "#3b82f6",
          zIndex: 50,
        }}
      />
      <TabsComponent
      sceneContainerStyle={{
        paddingBottom: insets.bottom ?? 0,
      }}
      screenOptions={{
        sceneStyle: {
          paddingBottom: insets.bottom ?? 0,
        },
        tabBarActiveTintColor: "#00B386",
        tabBarInactiveTintColor: "#fff",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: 'absolute',
          left: '5%',
          right: '5%',
          bottom: insets.bottom ?? 0,
          height: 64,
          backgroundColor: '#000',
          borderTopWidth: 0,
          overflow: 'hidden',
          paddingBottom: 6,
          paddingTop: 6,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.16,
          shadowRadius: 12,
          elevation: 12,
        },
        // Make each tab take equal width
        tabBarItemStyle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "가계부",
          tabBarLabel: "가계부",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="wallet-outline"
              style={{ color: focused ? "#00B386" : "#fff" }}
              size={28}
            />
          ),
          // label width not fixed to allow equal distribution
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "통계",
          tabBarLabel: "통계",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              size={28}
              name="stats-chart"
              style={{ color: focused ? "#00B386" : "#fff" }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarLabel: "설정",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              size={28}
              name="settings"
              style={{ color: focused ? "#00B386" : "#fff" }}
            />
          ),
        }}
      />
    </TabsComponent>
      {/* Floating + button placed at bottom-right of the screen (per-page) */}
      <TouchableOpacity
        onPress={openModal}
        style={{
          position: 'absolute',
          right: 16,
          // position above the tab bar
          bottom: (insets.bottom ?? 0) + 80,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#3b82f6',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 10,
          zIndex: 60,
        }}
      >
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>+</Text>
      </TouchableOpacity>
    </>
  );
}

export default function TabLayout() {
  return (
    <ModalProvider>
      <TabsContent />
    </ModalProvider>
  );
}