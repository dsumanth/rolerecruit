import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

export function DecisionRulesIndexScreen() {
  const navigation = useNavigation<any>();
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
      <View style={{ marginBottom: space[4] }}>
        <PressableButton
          variant="primary"
          onPress={() => navigation.navigate("RuleEditor", {})}
        >
          New rule
        </PressableButton>
      </View>
      {(!rules || rules.length === 0) && (
        <EmptyState
          title="No rules yet"
          body="Create a rule to auto-decide demos."
        />
      )}
      {(rules ?? []).map((r: any) => (
        <Pressable
          key={r._id}
          onPress={() => navigation.navigate("RuleEditor", { ruleId: r._id })}
          style={{ marginBottom: space[3] }}
        >
          <Card padding="md">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.ink,
                  fontSize: fonts.size.md,
                  fontWeight: fonts.weight.semibold,
                }}
              >
                {r.name}
              </Text>
              <Badge tone={r.isActive ? "success" : "neutral"}>
                {r.isActive ? "Active" : "Inactive"}
              </Badge>
            </View>
            <Text
              style={{
                color: colors.inkSecondary,
                fontSize: fonts.size.xs,
                marginTop: space[1],
              }}
            >
              {`${r.branches.length} branch${r.branches.length === 1 ? "" : "es"}, fallback: ${r.fallback}`}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
