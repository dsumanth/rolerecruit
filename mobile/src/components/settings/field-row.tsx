import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, radii, space } from "@/theme";

export type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";

export interface DraftField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  allowDictation?: boolean;
  weight?: number;
  choices?: string[];
}

const TYPES: FieldType[] = ["score_1_5", "score_1_10", "text", "choice"];

interface Props {
  field: DraftField;
  onChange: (next: DraftField) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

export function FieldRow({ field, onChange, onRemove, onMove }: Props) {
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
      <Text style={labelStyle}>Label</Text>
      <TextInput
        value={field.label}
        onChangeText={(t) => onChange({ ...field, label: t })}
        testID="field-label-input"
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {TYPES.map((t) => (
          <Pressable key={t} onPress={() => onChange({ ...field, type: t })}>
            <Text style={chipStyle(field.type === t)}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: space[3],
          alignItems: "center",
        }}
      >
        <Text style={labelStyle}>Required</Text>
        <Switch
          value={!!field.required}
          onValueChange={(v) => onChange({ ...field, required: v })}
        />
      </View>
      {field.type === "text" && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: space[2],
            alignItems: "center",
          }}
        >
          <Text style={labelStyle}>Allow dictation</Text>
          <Switch
            value={!!field.allowDictation}
            onValueChange={(v) => onChange({ ...field, allowDictation: v })}
          />
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: space[3],
          marginTop: space[3],
        }}
      >
        <Pressable onPress={() => onMove(-1)}>
          <Text style={actionStyle}>Up</Text>
        </Pressable>
        <Pressable onPress={() => onMove(1)}>
          <Text style={actionStyle}>Down</Text>
        </Pressable>
        <Pressable onPress={onRemove}>
          <Text style={{ ...actionStyle, color: colors.danger }}>Delete</Text>
        </Pressable>
      </View>
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
  paddingHorizontal: space[3],
  paddingVertical: space[2],
  color: colors.ink,
  fontSize: fonts.size.md,
  marginTop: space[1],
} as const;

const actionStyle = {
  color: colors.accent,
  fontSize: fonts.size.sm,
  fontWeight: fonts.weight.medium,
};

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
