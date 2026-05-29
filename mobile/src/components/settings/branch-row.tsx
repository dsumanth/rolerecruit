import { Pressable, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, radii, space } from "@/theme";

export type Action = "advance" | "reject" | "redemo" | "manual";

export interface DraftBranch {
  condition: { minHire?: number; maxReject?: number };
  action: Action;
}

const ACTIONS: Action[] = ["advance", "reject", "redemo", "manual"];

interface Props {
  branch: DraftBranch;
  onChange: (b: DraftBranch) => void;
  onRemove: () => void;
}

export function BranchRow({ branch, onChange, onRemove }: Props) {
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
      <Text style={labelStyle}>Min Hire recommendations</Text>
      <TextInput
        value={branch.condition.minHire?.toString() ?? ""}
        onChangeText={(t) =>
          onChange({
            ...branch,
            condition: {
              ...branch.condition,
              minHire: t ? parseInt(t, 10) : undefined,
            },
          })
        }
        keyboardType="number-pad"
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>
        Max Reject recommendations
      </Text>
      <TextInput
        value={branch.condition.maxReject?.toString() ?? ""}
        onChangeText={(t) =>
          onChange({
            ...branch,
            condition: {
              ...branch.condition,
              maxReject: t ? parseInt(t, 10) : undefined,
            },
          })
        }
        keyboardType="number-pad"
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>Action</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {ACTIONS.map((a) => (
          <Pressable key={a} onPress={() => onChange({ ...branch, action: a })}>
            <Text style={chipStyle(branch.action === a)}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onRemove}
        style={{ marginTop: space[3], alignSelf: "flex-end" }}
      >
        <Text style={{ color: colors.danger, fontSize: fonts.size.sm }}>
          Remove branch
        </Text>
      </Pressable>
    </Card>
  );
}

const labelStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.hairline,
  borderWidth: 1,
  borderRadius: radii.apple,
  padding: space[3],
  color: colors.ink,
  marginTop: space[1],
} as const;

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    overflow: "hidden" as const,
  };
}
