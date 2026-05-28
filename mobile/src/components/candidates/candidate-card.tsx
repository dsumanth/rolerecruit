import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Props {
  name: string;
  email?: string;
  subjects?: string[];
  onPress: () => void;
}

export function CandidateCard({ name, email, subjects, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID="candidate-card"
      style={{ marginBottom: space[3] }}
    >
      <Card padding="md">
        <Text
          style={{
            color: colors.ink,
            fontSize: fonts.size.md,
            fontWeight: fonts.weight.semibold,
          }}
        >
          {name}
        </Text>
        {email && (
          <Text
            style={{
              color: colors.inkSecondary,
              fontSize: fonts.size.sm,
              marginTop: 2,
            }}
          >
            {email}
          </Text>
        )}
        {subjects && subjects.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: space[2],
              gap: space[1],
            }}
          >
            {subjects.map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: colors.accentSoft,
                  paddingHorizontal: space[2],
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: fonts.size.xs }}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Pressable>
  );
}
