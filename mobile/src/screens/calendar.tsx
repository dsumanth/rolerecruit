import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function CalendarScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="calendar-stub">Calendar</Text>
    </View>
  );
}
