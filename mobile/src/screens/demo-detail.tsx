import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { PressableButton } from "@/components/ui/pressable-button";
import { EvaluatorStatusRow } from "@/components/demos/evaluator-status-row";
import { useRoleContext } from "@/hooks/use-role-context";
import { colors, fonts, space } from "@/theme";

type Params = { demoId: string; inviteId: string };

const MODE_LABEL: Record<string, string> = { live: "Live", post: "Post-demo", async: "Async" };
const FORMAT_LABEL: Record<string, string> = { classroom: "Classroom", mock: "Mock", recorded: "Recorded" };

function formatWhen(ts: number, durationMin: number) {
  const start = new Date(ts).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  return `${start} (${durationMin} min)`;
}

export function DemoDetailScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: Params };
}) {
  const { demoId, inviteId } = route.params;
  const role = useRoleContext();
  const demo = useQuery(api.demoSessions.get, { demoId: demoId as any });
  const application = useQuery(
    api.applications.getWithCandidateAndJob,
    demo?.applicationId ? { applicationId: demo.applicationId as any } : "skip",
  );
  const invitesRaw = useQuery(api.evaluationInvites.listForDemoWithProfiles, { demoId: demoId as any });
  const markViewed = useMutation(api.evaluationInvites.markViewed);

  useEffect(() => {
    markViewed({ inviteId: inviteId as any }).catch(() => {});
  }, [inviteId, markViewed]);

  if (!demo || !application || !invitesRaw) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  const me = invitesRaw.find((i: any) => i._id === inviteId);
  const siblings = invitesRaw.filter((i: any) => i._id !== inviteId && i.status !== "cancelled");
  const canStart = me && me.status !== "submitted" && me.status !== "cancelled" && me.status !== "declined";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
    >
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.xxl, fontWeight: fonts.weight.bold, color: colors.ink }}>
          {application.name}
        </Text>
        {application.subject && (
          <Text style={{ fontSize: fonts.size.md, color: colors.inkSecondary, marginTop: space[1] }}>
            {application.subject}
          </Text>
        )}
        <Text style={{ marginTop: space[3], color: colors.ink, fontSize: fonts.size.sm }}>
          {formatWhen(demo.scheduledAt, demo.durationMinutes)}
        </Text>
        <Text style={{ marginTop: space[1], color: colors.inkSecondary, fontSize: fonts.size.sm }}>
          {MODE_LABEL[demo.mode]} - {FORMAT_LABEL[demo.format]}
          {demo.location ? ` - ${demo.location}` : ""}
        </Text>
      </Card>

      {role.isHR && (
        <View style={{ marginTop: space[3] }}>
          <PressableButton
            variant="secondary"
            onPress={() => navigation.navigate("DemoSummary", { demoId })}
          >
            View summary
          </PressableButton>
        </View>
      )}

      <Text style={{ marginTop: space[6], marginBottom: space[2], color: colors.inkSecondary, fontSize: fonts.size.sm, fontWeight: fonts.weight.semibold, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Other evaluators
      </Text>
      <Card padding="md">
        {siblings.length === 0 ? (
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>You're the only evaluator.</Text>
        ) : (
          siblings.map((s: any) => (
            <EvaluatorStatusRow
              key={s._id}
              name={s.profile?.name ?? "Evaluator"}
              role={s.evaluatorRole}
              status={s.status}
            />
          ))
        )}
      </Card>

      <View style={{ marginTop: space[6] }}>
        {canStart ? (
          <PressableButton
            size="lg"
            onPress={() => navigation.navigate("EvaluationForm", { inviteId, demoId })}
          >
            Start evaluation
          </PressableButton>
        ) : (
          <Text style={{ textAlign: "center", color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            You have already {me?.status ?? "responded"} for this demo.
          </Text>
        )}
        <View style={{ marginTop: space[3] }}>
          <PressableButton
            variant="ghost"
            onPress={() => navigation.navigate("DeclineInvite", { inviteId })}
          >
            Decline this invite
          </PressableButton>
        </View>
      </View>
    </ScrollView>
  );
}
