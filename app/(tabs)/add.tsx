import { Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddPage() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text>임시페이지</Text>
      </View>
    </SafeAreaView>
  );
}