import { Pressable, Text, TextInput, View } from "react-native";
import type { EvaluatorRole } from "@convex/types";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, radii, space } from "@/theme";

export interface StaffRow {
  _id: string;
  name: string;
  role: EvaluatorRole;
}

export interface EvaluatorPick {
  userId: string;
  role: EvaluatorRole;
}

export type Format = "classroom" | "mock" | "recorded";

interface Props {
  format: Format;
  location: string;
  videoUrl: string;
  staff: StaffRow[];
  selected: EvaluatorPick[];
  onChange: (patch: {
    location?: string;
    videoUrl?: string;
    evaluators?: EvaluatorPick[];
  }) => void;
}

export function StepEvaluators({
  format,
  location,
  videoUrl,
  staff,
  selected,
  onChange,
}: Props) {
  const toggle = (row: StaffRow) => {
    const exists = selected.find((p) => p.userId === row._id);
    const next = exists
      ? selected.filter((p) => p.userId !== row._id)
      : [...selected, { userId: row._id, role: row.role }];
    onChange({ evaluators: next });
  };

  return (
    <View style={{ gap: space[4] }}>
      {format === "classroom" && (
        <View>
          <Text style={labelStyle}>Location</Text>
          <TextInput
            value={location}
            onChangeText={(t) => onChange({ location: t })}
            placeholder="Classroom 12B"
            placeholderTextColor={colors.inkTertiary}
            style={inputStyle}
          />
        </View>
      )}
      {format === "recorded" && (
        <View>
          <Text style={labelStyle}>Video URL</Text>
          <TextInput
            value={videoUrl}
            onChangeText={(t) => onChange({ videoUrl: t })}
            placeholder="https://..."
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>
      )}

      <View>
        <Text style={labelStyle}>{`Evaluators (${selected.length})`}</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space[2],
            marginBottom: space[2],
          }}
        >
          {selected.map((p) => {
            const row = staff.find((s) => s._id === p.userId);
            return row ? (
              <Badge key={p.userId} tone="info">
                {row.name}
              </Badge>
            ) : null;
          })}
        </View>
        {staff.map((row) => {
          const isSelected = !!selected.find((p) => p.userId === row._id);
          return (
            <Pressable
              key={row._id}
              onPress={() => toggle(row)}
              style={{
                padding: space[3],
                marginBottom: space[2],
                backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                borderColor: isSelected ? colors.accent : colors.hairline,
                borderWidth: 1,
                borderRadius: radii.apple,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.ink, fontSize: fonts.size.md }}>
                {row.name}
              </Text>
              <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs }}>
                {row.role}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const labelStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  marginBottom: space[1],
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.hairline,
  borderWidth: 1,
  borderRadius: radii.apple,
  paddingHorizontal: space[3],
  paddingVertical: space[2],
  color: colors.ink,
  fontSize: fonts.size.md,
} as const;
