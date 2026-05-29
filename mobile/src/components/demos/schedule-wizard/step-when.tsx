import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export type Mode = "live" | "post" | "async";
export type Format = "classroom" | "mock" | "recorded";

export interface StepWhenValue {
  date: string;
  time: string;
  durationMinutes: number;
  mode: Mode;
  format: Format;
}

const MODES: readonly Mode[] = ["live", "post", "async"] as const;
const FORMATS: readonly Format[] = ["classroom", "mock", "recorded"] as const;

interface Props {
  value: StepWhenValue;
  onChange: (next: StepWhenValue) => void;
}

export function StepWhen({ value, onChange }: Props) {
  return (
    <View style={{ gap: space[4] }}>
      <Field label="Date (YYYY-MM-DD)">
        <TextInput
          value={value.date}
          onChangeText={(t) => onChange({ ...value, date: t })}
          placeholder="2026-06-15"
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="none"
          style={inputStyle}
        />
      </Field>
      <Field label="Time (HH:mm, 24h)">
        <TextInput
          value={value.time}
          onChangeText={(t) => onChange({ ...value, time: t })}
          placeholder="11:30"
          placeholderTextColor={colors.inkTertiary}
          style={inputStyle}
        />
      </Field>
      <Field label="Duration (minutes)">
        <TextInput
          value={String(value.durationMinutes)}
          onChangeText={(t) => onChange({ ...value, durationMinutes: parseInt(t || "0", 10) })}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </Field>
      <Field label="Mode">
        <Row>
          {MODES.map((m) => (
            <Pressable key={m} onPress={() => onChange({ ...value, mode: m })}>
              <Text style={chipStyle(value.mode === m)}>{m}</Text>
            </Pressable>
          ))}
        </Row>
      </Field>
      <Field label="Format">
        <Row>
          {FORMATS.map((f) => (
            <Pressable key={f} onPress={() => onChange({ ...value, format: f })}>
              <Text style={chipStyle(value.format === f)}>{f}</Text>
            </Pressable>
          ))}
        </Row>
      </Field>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text
        style={{
          color: colors.inkTertiary,
          fontSize: fonts.size.xs,
          marginBottom: space[1],
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
      {children}
    </View>
  );
}

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

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.pill,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    overflow: "hidden" as const,
  };
}
