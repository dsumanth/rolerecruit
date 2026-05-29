import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export function ScoreField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "score_1_5" | "score_1_10";
  value: number | undefined;
  onChange: (next: number) => void;
}) {
  const max = type === "score_1_5" ? 5 : 10;
  const scale = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {scale.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              accessibilityLabel={`score-${n}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(n)}
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.apple,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accent : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontWeight: fonts.weight.semibold }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
