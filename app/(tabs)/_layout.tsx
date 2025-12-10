import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
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
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          bottom: insets.bottom,
          height: 70,
          paddingBottom: 6,
          paddingTop: 6,
          backgroundColor: "#000",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="home"
              style={{ color: focused ? "#00B386" : "#404040" }}
              size={28}
            />
          ),
          tabBarLabelStyle:{
            width: 40
          }
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: "추가",
          tabBarButton: function(props) {
            return (
              <TouchableOpacity
              onPress={openModal}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "#3b82f6",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 10,
                alignSelf: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 8,
              }}
            >
              <Text
                style={{ color: "white", fontSize: 32, fontWeight: "bold" }}
              >
                +
              </Text>
            </TouchableOpacity>
            )
          },
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              size={28}
              name="settings"
              style={{ color: focused ? "#00B386" : "#404040" }}
            />
          ),
        }}
      />
    </Tabs>
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