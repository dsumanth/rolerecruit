import { ScrollView, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, space } from "@/theme";

type DemoStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

function toneFor(status: DemoStatus): "success" | "danger" | "info" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  return "info";
}

export function CandidateDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const candidateId = route.params.candidateId;

  const candidate = useQuery(api.candidates.get, { candidateId } as any);
  const applications = useQuery(api.applications.listForCandidate, { candidateId });
  const firstAppId = applications?.[0]?._id;
  const demos = useQuery(
    api.demoSessions.listForCandidate,
    firstAppId ? { applicationId: firstAppId } : "skip",
  );

  if (!candidate) {
    return (
      <View
        style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}
      >
        <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <Card padding="lg">
        <Text
          style={{
            color: colors.ink,
            fontSize: fonts.size.xl,
            fontWeight: fonts.weight.semibold,
          }}
        >
          {candidate.name}
        </Text>
        {candidate.email && (
          <Text
            style={{
              color: colors.inkSecondary,
              fontSize: fonts.size.sm,
              marginTop: space[1],
            }}
          >
            {candidate.email}
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space[4] }}>
        <PressableButton
          variant="primary"
          disabled={!firstAppId}
          onPress={() => {
            if (firstAppId) {
              navigation.navigate("ScheduleDemo", { applicationId: firstAppId });
            }
          }}
        >
          Schedule new demo
        </PressableButton>
      </View>

      <Text
        style={{
          color: colors.ink,
          fontSize: fonts.size.lg,
          fontWeight: fonts.weight.semibold,
          marginTop: space[6],
          marginBottom: space[2],
        }}
      >
        Demos
      </Text>
      {demos?.length === 0 && (
        <Text style={{ color: colors.inkSecondary }}>No demos scheduled yet.</Text>
      )}
      {(demos ?? []).map((d: any) => (
        <Card key={d._id} padding="md" style={{ marginBottom: space[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.ink, fontSize: fonts.size.md }}>
              {new Date(d.scheduledAt).toLocaleString()}
            </Text>
            <Badge tone={toneFor(d.status as DemoStatus)}>{d.status}</Badge>
          </View>
          <Text
            style={{
              color: colors.inkSecondary,
              fontSize: fonts.size.sm,
              marginTop: space[1],
            }}
          >
            {d.mode} / {d.format} / {d.durationMinutes} min
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
