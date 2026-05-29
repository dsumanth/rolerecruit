import { Text, View } from "react-native";
import { colors, space, fonts } from "@/theme";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ padding: space[6], alignItems: "center" }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {title}
      </Text>
      {body && (
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, textAlign: "center" }}>
          {body}
        </Text>
      )}
    </View>
  );
}
