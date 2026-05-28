import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { AppProviders } from "@/providers/app-providers";
import { colors } from "@/theme";

export default function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <Text accessibilityLabel="smoke">Rolerecruit mobile boots.</Text>
        <StatusBar style="auto" />
      </View>
    </AppProviders>
  );
}
