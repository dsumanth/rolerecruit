import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
      <Text accessibilityLabel="smoke">Rolerecruit mobile boots.</Text>
      <StatusBar style="auto" />
    </View>
  );
}
