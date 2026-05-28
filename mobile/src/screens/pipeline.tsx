import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { usePipeline, type PipelineApplication } from "@/hooks/use-pipeline";
import { StageChips } from "@/components/pipeline/stage-chips";
import { ApplicationCard } from "@/components/pipeline/application-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, radii, space } from "@/theme";

export function PipelineScreen() {
  const role = useRoleContext();
  const { jobs, selectedJobId, setSelectedJobId, stages, applicationsByStage } =
    usePipeline({ schoolId: role.schoolId });
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const flatApps: PipelineApplication[] = stageFilter
    ? applicationsByStage[stageFilter] ?? []
    : Object.values(applicationsByStage).flat();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingTop: space[3],
          gap: space[2],
        }}
      >
        {jobs.map((j) => (
          <Pressable key={j._id} onPress={() => setSelectedJobId(j._id)}>
            <Text style={jobChipStyle(j._id === selectedJobId)}>{j.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ marginTop: space[3] }}>
        <StageChips
          stages={stages}
          selectedId={stageFilter}
          onSelect={setStageFilter}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        {!selectedJobId && (
          <EmptyState
            title="Pick a role"
            body="Select a job above to see its pipeline."
          />
        )}
        {selectedJobId && flatApps.length === 0 && (
          <EmptyState
            title="No applications"
            body="No candidates at this stage yet."
          />
        )}
        {flatApps.map((a) => (
          <PipelineApplicationCard
            key={a._id}
            applicationId={a._id}
            candidateId={a.candidateId ?? ""}
            stage={a.stage}
            matchScore={a.aiMatchScore}
            onPress={() =>
              navigation.navigate("CandidateDetail", {
                candidateId: a.candidateId,
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PipelineApplicationCard(props: {
  applicationId: string;
  candidateId: string;
  stage: string;
  matchScore?: number;
  onPress: () => void;
}) {
  const candidate = useQuery(
    api.candidates.get,
    props.candidateId ? ({ candidateId: props.candidateId } as any) : "skip",
  );
  return (
    <ApplicationCard
      applicationId={props.applicationId}
      candidateName={candidate?.name ?? "Loading..."}
      stage={props.stage}
      matchScore={props.matchScore}
      onPress={props.onPress}
    />
  );
}

function jobChipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.pill,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    overflow: "hidden" as const,
  };
}
