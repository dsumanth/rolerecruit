import { Text, View } from "react-native";
import { colors, space } from "@/theme";
export function PipelineScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.ink }}>Pipeline</Text>
    </View>
  );
}
