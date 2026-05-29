import { Text, View } from "react-native";
import { colors, radii, space, fonts } from "@/theme";

type Tone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: colors.accentSoft, fg: colors.accent },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.hairline, fg: colors.inkSecondary },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const t = TONE[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: t.fg, fontSize: fonts.size.xs, fontWeight: fonts.weight.semibold }}>
        {children}
      </Text>
    </View>
  );
}
