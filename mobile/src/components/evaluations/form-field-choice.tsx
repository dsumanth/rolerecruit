import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export function ChoiceField({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: string[];
  value: string | undefined;
  onChange: (next: string) => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {choices.map((c) => {
          const selected = value === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: space[3], paddingVertical: space[2],
                borderRadius: radii.pill, borderWidth: 1,
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accent : colors.surface,
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontWeight: fonts.weight.medium }}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
