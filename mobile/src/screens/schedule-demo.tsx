import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { EvaluatorRole } from "@convex/types";
import {
  StepWhen,
  type StepWhenValue,
} from "@/components/demos/schedule-wizard/step-when";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, space } from "@/theme";

export type Evaluator = { userId: string; role: EvaluatorRole };

export interface ScheduleDraft extends StepWhenValue {
  location?: string;
  videoUrl?: string;
  evaluators: Evaluator[];
  decisionRuleId?: string;
}

export function mergeTimestamp(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export function ScheduleDemoScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { applicationId, parentDemoId } = route.params ?? {};
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ScheduleDraft>({
    date: defaultDate(),
    time: "11:00",
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    evaluators: [],
  });

  void applicationId;
  void parentDemoId;

  const canAdvance =
    step === 1
      ? mergeTimestamp(draft.date, draft.time) > Date.now() && draft.durationMinutes > 0
      : step === 2
        ? draft.evaluators.length > 0
        : true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>
          Step {step} of 3
        </Text>
        {step === 1 && (
          <StepWhen
            value={{
              date: draft.date,
              time: draft.time,
              durationMinutes: draft.durationMinutes,
              mode: draft.mode,
              format: draft.format,
            }}
            onChange={(next) => setDraft({ ...draft, ...next })}
          />
        )}
        {step === 2 && (
          <Text style={{ color: colors.ink }}>Evaluators (Task 11)</Text>
        )}
        {step === 3 && (
          <Text style={{ color: colors.ink }}>Review (Task 12)</Text>
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          padding: space[4],
          gap: space[3],
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          backgroundColor: colors.surface,
        }}
      >
        {step > 1 && (
          <View style={{ flex: 1 }}>
            <PressableButton variant="ghost" onPress={() => setStep(step - 1)}>
              Back
            </PressableButton>
          </View>
        )}
        <View style={{ flex: 2 }}>
          <PressableButton
            variant="primary"
            disabled={!canAdvance}
            onPress={() => (step < 3 ? setStep(step + 1) : navigation.goBack())}
          >
            {step < 3 ? "Next" : "Confirm"}
          </PressableButton>
        </View>
      </View>
    </View>
  );
}

function defaultDate(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
