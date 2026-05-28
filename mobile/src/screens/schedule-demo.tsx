import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { EvaluatorRole } from "@convex/types";
import {
  StepWhen,
  type StepWhenValue,
} from "@/components/demos/schedule-wizard/step-when";
import { StepEvaluators } from "@/components/demos/schedule-wizard/step-evaluators";
import { StepReview } from "@/components/demos/schedule-wizard/step-review";
import { PressableButton } from "@/components/ui/pressable-button";
import { useRoleContext } from "@/hooks/use-role-context";
import { useStaffDirectory } from "@/hooks/use-staff-directory";
import { useActiveDecisionRules } from "@/hooks/use-active-decision-rules";
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

  const role = useRoleContext();
  const { staff } = useStaffDirectory({ schoolId: role.schoolId });
  const { rules } = useActiveDecisionRules({ schoolId: role.schoolId });
  const createDemo = useMutation(api.demoSessions.create);

  const parentInvites = useQuery(
    api.evaluationInvites.listForDemoWithProfiles,
    parentDemoId ? { demoId: parentDemoId as any } : "skip",
  );

  useEffect(() => {
    if (!parentInvites || draft.evaluators.length > 0) return;
    const evaluators = parentInvites
      .filter((r: any) => r.status !== "cancelled")
      .map((r: any) => ({
        userId: r.evaluatorUserId,
        role: r.evaluatorRole,
      }));
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setDraft((d) => ({
      ...d,
      evaluators,
      date: `${inThreeDays.getFullYear()}-${pad(inThreeDays.getMonth() + 1)}-${pad(inThreeDays.getDate())}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentInvites]);

  const canAdvance =
    step === 1
      ? mergeTimestamp(draft.date, draft.time) > Date.now() && draft.durationMinutes > 0
      : step === 2
        ? draft.evaluators.length > 0
        : true;

  const confirm = async () => {
    if (!role.schoolId || !role.userProfileId) return;
    await createDemo({
      applicationId: applicationId as any,
      schoolId: role.schoolId as any,
      scheduledAt: mergeTimestamp(draft.date, draft.time),
      durationMinutes: draft.durationMinutes,
      mode: draft.mode,
      format: draft.format,
      location: draft.location,
      videoUrl: draft.videoUrl,
      evaluators: draft.evaluators as any,
      createdBy: role.userProfileId as any,
      parentDemoId: parentDemoId as any,
      decisionRuleId: draft.decisionRuleId as any,
    });
    navigation.goBack();
  };

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
          <StepEvaluators
            format={draft.format}
            location={draft.location ?? ""}
            videoUrl={draft.videoUrl ?? ""}
            staff={staff}
            selected={draft.evaluators}
            onChange={(patch) =>
              setDraft({
                ...draft,
                ...(patch.location !== undefined ? { location: patch.location } : {}),
                ...(patch.videoUrl !== undefined ? { videoUrl: patch.videoUrl } : {}),
                ...(patch.evaluators !== undefined ? { evaluators: patch.evaluators } : {}),
              })
            }
          />
        )}
        {step === 3 && (
          <StepReview
            draft={draft}
            rules={rules}
            selectedRuleId={draft.decisionRuleId ?? null}
            onSelectRule={(id) =>
              setDraft({ ...draft, decisionRuleId: id ?? undefined })
            }
          />
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
            onPress={() => (step < 3 ? setStep(step + 1) : confirm())}
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
