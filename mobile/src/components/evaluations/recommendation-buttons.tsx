import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

type Rec = "hire" | "maybe" | "reject";
const OPTIONS: { value: Rec; label: string; tone: string }[] = [
  { value: "hire", label: "Hire", tone: colors.success },
  { value: "maybe", label: "Maybe", tone: colors.warning },
  { value: "reject", label: "Reject", tone: colors.danger },
];

export function RecommendationButtons({
  value,
  onChange,
}: {
  value: Rec | undefined;
  onChange: (next: Rec) => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        Recommendation
      </Text>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        {OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                paddingVertical: space[4],
                borderRadius: radii.apple,
                borderWidth: 2,
                borderColor: selected ? o.tone : colors.hairline,
                backgroundColor: selected ? o.tone : colors.surface,
                alignItems: "center",
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.bold }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
