import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function EvaluationFormScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="form-stub">Evaluation form (stub)</Text>
    </View>
  );
}
