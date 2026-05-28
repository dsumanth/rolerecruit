import { Text, View } from "react-native";
import { colors, space } from "@/theme";
export function CandidatesScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.ink }}>Candidates</Text>
    </View>
  );
}
