import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function InboxScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="inbox-stub">Inbox</Text>
    </View>
  );
}
