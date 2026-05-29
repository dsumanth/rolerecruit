import { Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export interface AppliedDecision {
  action: "advance" | "reject" | "redemo" | "manual";
  appliedAt: number;
  note?: string;
}

interface Props {
  applied: AppliedDecision;
}

// Map decision actions to existing token-based tones rather than raw hex.
const TONE: Record<
  AppliedDecision["action"],
  { bg: string; border: string; ink: string; label: string }
> = {
  advance: {
    bg: colors.successSoft,
    border: colors.success,
    ink: colors.success,
    label: "Advanced",
  },
  reject: {
    bg: colors.dangerSoft,
    border: colors.danger,
    ink: colors.danger,
    label: "Rejected",
  },
  redemo: {
    bg: colors.warningSoft,
    border: colors.warning,
    ink: colors.warning,
    label: "Re-demo scheduled",
  },
  manual: {
    bg: colors.accentSoft,
    border: colors.accent,
    ink: colors.accent,
    label: "Manual review",
  },
};

export function AppliedDecisionBanner({ applied }: Props) {
  const tone = TONE[applied.action] ?? TONE.manual;
  return (
    <View
      style={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        borderWidth: 1,
        borderRadius: radii.apple,
        padding: space[3],
        marginBottom: space[4],
      }}
    >
      <Text
        style={{
          color: tone.ink,
          fontSize: fonts.size.md,
          fontWeight: fonts.weight.semibold,
        }}
      >
        {tone.label}
      </Text>
      <Text
        style={{
          color: tone.ink,
          fontSize: fonts.size.sm,
          marginTop: space[1],
        }}
      >
        {applied.note ?? new Date(applied.appliedAt).toLocaleString()}
      </Text>
    </View>
  );
}
