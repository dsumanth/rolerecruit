import { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScoreField } from "@/components/evaluations/form-field-score";
import { TextField } from "@/components/evaluations/form-field-text";
import { ChoiceField } from "@/components/evaluations/form-field-choice";
import { RecommendationButtons } from "@/components/evaluations/recommendation-buttons";
import { DictationOverlay } from "@/components/evaluations/dictation-overlay";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, space } from "@/theme";

type Params = { inviteId: string; demoId: string };
type FieldDef = {
  key: string;
  label: string;
  type: "score_1_5" | "score_1_10" | "text" | "choice";
  choices?: string[];
  required?: boolean;
  allowDictation?: boolean;
};

type VoiceCapture = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export function EvaluationFormScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: Params };
}) {
  const { inviteId } = route.params;
  const invite = useQuery(api.evaluationInvites.get, { inviteId: inviteId as any });
  const template = useQuery(
    api.formTemplates.getById,
    invite?.formTemplateId ? { templateId: invite.formTemplateId as any } : "skip",
  );
  const submit = useMutation(api.evaluations.submit);

  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "reject" | undefined>(undefined);
  const [voiceInputs, setVoiceInputs] = useState<VoiceCapture[]>([]);
  const [dictationField, setDictationField] = useState<FieldDef | null>(null);
  const [busy, setBusy] = useState(false);

  const fields: FieldDef[] = useMemo(() => (template?.fields as FieldDef[]) ?? [], [template]);

  function update(key: string, value: number | string) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function handleDictationResult(field: FieldDef, capture: VoiceCapture) {
    setVoiceInputs((prev) => [...prev.filter((v) => v.fieldKey !== field.key), capture]);
    setResponses((prev) => ({ ...prev, [field.key]: capture.summaryPoints.join("\n") }));
    setDictationField(null);
  }

  async function onSubmit() {
    for (const f of fields) {
      if (f.required && (responses[f.key] === undefined || responses[f.key] === "")) {
        Alert.alert("Required", `${f.label} is required.`);
        return;
      }
    }
    setBusy(true);
    try {
      await submit({
        inviteId: inviteId as any,
        responses,
        recommendation,
        voiceInputs: voiceInputs.length > 0 ? voiceInputs : undefined,
        submittedFromPlatform: Platform.OS === "ios" ? "mobile_ios" : "mobile_android",
      });
      navigation.reset({ index: 0, routes: [{ name: "EvaluatorTabs" }] });
    } catch (err) {
      Alert.alert("Could not submit", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  if (!invite || !template) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 140 }}>
        {fields.map((f) => {
          if (f.type === "score_1_5" || f.type === "score_1_10") {
            return (
              <ScoreField
                key={f.key}
                label={f.label}
                type={f.type}
                value={responses[f.key] as number | undefined}
                onChange={(n) => update(f.key, n)}
              />
            );
          }
          if (f.type === "text") {
            return (
              <TextField
                key={f.key}
                label={f.label}
                value={(responses[f.key] as string) ?? ""}
                onChange={(s) => update(f.key, s)}
                allowDictation={f.allowDictation ?? false}
                onMicPress={() => setDictationField(f)}
              />
            );
          }
          if (f.type === "choice") {
            return (
              <ChoiceField
                key={f.key}
                label={f.label}
                choices={f.choices ?? []}
                value={responses[f.key] as string | undefined}
                onChange={(c) => update(f.key, c)}
              />
            );
          }
          return null;
        })}
        <RecommendationButtons value={recommendation} onChange={setRecommendation} />
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          padding: space[4],
          backgroundColor: colors.surfaceFloating,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
        }}
      >
        <PressableButton size="lg" onPress={onSubmit} disabled={busy}>
          {busy ? "Submitting..." : "Submit evaluation"}
        </PressableButton>
      </View>

      {dictationField && (
        <DictationOverlay
          fieldKey={dictationField.key}
          language="en-IN"
          onComplete={(capture) => handleDictationResult(dictationField, capture)}
          onCancel={() => setDictationField(null)}
        />
      )}
    </View>
  );
}
