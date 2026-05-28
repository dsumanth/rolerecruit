import { ScrollView, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@convex/_generated/api";
import { useDemoAggregate } from "@/hooks/use-demo-aggregate";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { AppliedDecisionBanner } from "@/components/demos/applied-decision-banner";
import { PerEvaluatorRow } from "@/components/demos/per-evaluator-row";
import { colors, fonts, space } from "@/theme";

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "scheduled") return "warning";
  return "info";
}

export function DemoSummaryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const demoId = route.params.demoId as string;
  const role = useRoleContext();
  const apply = useMutation(api.demoSessions.applyDecision);
  const agg = useDemoAggregate(demoId);

  if (agg.loading || !agg.demo) {
    return (
      <View
        style={{
          flex: 1,
          padding: space[4],
          backgroundColor: colors.surfaceCanvas,
        }}
      >
        <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  const { demo, recommendationTally, dimensionAverages, perEvaluator } = agg;
  const canDecide = demo.status === "completed" && !demo.appliedDecision;

  const onDecide = async (action: "advance" | "reject" | "manual") => {
    await apply({
      demoId: demoId as any,
      action,
      appliedBy: role.userProfileId as any,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      {demo.appliedDecision && <AppliedDecisionBanner applied={demo.appliedDecision} />}

      <Card padding="md" style={{ marginBottom: space[4] }}>
        <Text
          style={{
            color: colors.inkTertiary,
            fontSize: fonts.size.xs,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Demo
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: fonts.size.lg,
            fontWeight: fonts.weight.semibold,
            marginTop: space[1],
          }}
        >
          {new Date(demo.scheduledAt).toLocaleString()}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: space[2],
          }}
        >
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            {`${demo.mode} / ${demo.format} / ${demo.durationMinutes} min`}
          </Text>
          <View style={{ marginLeft: space[2] }}>
            <Badge tone={statusTone(demo.status)}>{demo.status}</Badge>
          </View>
        </View>
      </Card>

      <Card padding="md" style={{ marginBottom: space[4] }}>
        <Text
          style={{
            color: colors.inkTertiary,
            fontSize: fonts.size.xs,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Recommendations
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: fonts.size.md,
            marginTop: space[1],
          }}
        >
          {`Hire: ${recommendationTally?.hire ?? 0}  |  Maybe: ${recommendationTally?.maybe ?? 0}  |  Reject: ${recommendationTally?.reject ?? 0}`}
        </Text>
      </Card>

      {dimensionAverages && Object.keys(dimensionAverages).length > 0 && (
        <Card padding="md" style={{ marginBottom: space[4] }}>
          <Text
            style={{
              color: colors.inkTertiary,
              fontSize: fonts.size.xs,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Averages
          </Text>
          {Object.entries(dimensionAverages).map(([k, v]) => (
            <Text
              key={k}
              style={{
                color: colors.ink,
                fontSize: fonts.size.sm,
                marginTop: 2,
              }}
            >
              {`${k}: ${Number(v).toFixed(1)}`}
            </Text>
          ))}
        </Card>
      )}

      <Text
        style={{
          color: colors.ink,
          fontSize: fonts.size.lg,
          fontWeight: fonts.weight.semibold,
          marginBottom: space[2],
        }}
      >
        Evaluators
      </Text>
      {(perEvaluator ?? []).map((row: any) => (
        <PerEvaluatorRow
          key={row.invite._id}
          name={row.evaluatorName ?? "Unknown"}
          role={row.evaluatorRole}
          status={row.invite.status}
          recommendation={row.evaluation?.recommendation}
          bullets={row.evaluation?.voiceInputs?.[0]?.summaryPoints}
        />
      ))}

      {canDecide && (
        <View style={{ marginTop: space[6], gap: space[3] }}>
          <PressableButton variant="primary" onPress={() => onDecide("advance")}>
            Advance
          </PressableButton>
          <PressableButton variant="danger" onPress={() => onDecide("reject")}>
            Reject
          </PressableButton>
          <PressableButton
            variant="secondary"
            onPress={() =>
              navigation.navigate("ScheduleDemo", {
                applicationId: demo.applicationId,
                parentDemoId: demoId,
              })
            }
          >
            Schedule re-demo
          </PressableButton>
          <PressableButton variant="ghost" onPress={() => onDecide("manual")}>
            Mark as manual review
          </PressableButton>
        </View>
      )}
    </ScrollView>
  );
}
