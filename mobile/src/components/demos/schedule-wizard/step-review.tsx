import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Draft {
  date: string;
  time: string;
  durationMinutes: number;
  mode: string;
  format: string;
  location?: string;
  videoUrl?: string;
  evaluators: { userId: string; role: string }[];
}

interface Props {
  draft: Draft;
  rules: Array<{ _id: string; name: string }>;
  selectedRuleId: string | null;
  onSelectRule: (id: string | null) => void;
}

export function StepReview({ draft, rules, selectedRuleId, onSelectRule }: Props) {
  return (
    <View style={{ gap: space[4] }}>
      <Card padding="md">
        <Text style={titleStyle}>When</Text>
        <Text style={bodyStyle}>{`${draft.date} ${draft.time}`}</Text>
        <Text style={metaStyle}>{`${draft.durationMinutes} min / ${draft.mode} / ${draft.format}`}</Text>
        {draft.location ? (
          <Text style={metaStyle}>{`Location: ${draft.location}`}</Text>
        ) : null}
        {draft.videoUrl ? (
          <Text style={metaStyle}>{`Video: ${draft.videoUrl}`}</Text>
        ) : null}
      </Card>
      <Card padding="md">
        <Text style={titleStyle}>{`Evaluators (${draft.evaluators.length})`}</Text>
        {draft.evaluators.map((e) => (
          <Text key={e.userId} style={metaStyle}>
            {e.role}
          </Text>
        ))}
      </Card>
      <Card padding="md">
        <Text style={titleStyle}>Decision rule (optional)</Text>
        <Pressable
          onPress={() => onSelectRule(null)}
          style={{ marginVertical: space[1] }}
        >
          <Text style={ruleStyle(selectedRuleId === null)}>None / manual decision</Text>
        </Pressable>
        {rules.map((r) => (
          <Pressable
            key={r._id}
            onPress={() => onSelectRule(r._id)}
            style={{ marginVertical: space[1] }}
          >
            <Text style={ruleStyle(selectedRuleId === r._id)}>{r.name}</Text>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const titleStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  marginBottom: space[1],
};

const bodyStyle = {
  color: colors.ink,
  fontSize: fonts.size.lg,
  fontWeight: fonts.weight.semibold,
};

const metaStyle = {
  color: colors.inkSecondary,
  fontSize: fonts.size.sm,
  marginTop: space[1],
};

function ruleStyle(active: boolean) {
  return {
    color: active ? colors.accent : colors.ink,
    fontSize: fonts.size.md,
    fontWeight: active ? fonts.weight.semibold : fonts.weight.medium,
  };
}
