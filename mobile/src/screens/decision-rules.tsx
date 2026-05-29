import { ScrollView, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { summarizeRule } from "@convex/lib/decisionRuleSummary";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

export function DecisionRulesIndexScreen() {
  const role = useRoleContext();
  const rules = useQuery(
    api.decisionRules.list,
    role.schoolId ? { schoolId: role.schoolId as any } : "skip",
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      {(!rules || rules.length === 0) && (
        <EmptyState title="No rules yet" body="Decision rules are created on the web dashboard." />
      )}
      {(rules ?? []).map((r: any) => (
        <Card key={r._id} padding="md" style={{ marginBottom: space[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
              {r.name}
            </Text>
            <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge>
          </View>
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: space[2] }}>
            {summarizeRule({ steps: r.steps, otherwise: r.otherwise })}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
