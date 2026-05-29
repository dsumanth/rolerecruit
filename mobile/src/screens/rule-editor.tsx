import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import {
  BranchRow,
  type Action,
  type DraftBranch,
} from "@/components/settings/branch-row";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

const ACTIONS: Action[] = ["advance", "reject", "redemo", "manual"];

export function RuleEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const role = useRoleContext();
  const ruleId = route.params?.ruleId as string | undefined;
  const existing = useQuery(
    api.decisionRules.get,
    ruleId ? { ruleId: ruleId as any } : "skip",
  );
  const create = useMutation(api.decisionRules.create);
  const update = useMutation(api.decisionRules.update);

  const [name, setName] = useState<string | null>(null);
  const [branches, setBranches] = useState<DraftBranch[] | null>(null);
  const [fallback, setFallback] = useState<Action | null>(null);

  useEffect(() => {
    if (!ruleId && name === null) {
      setName("");
      setBranches([]);
      setFallback("manual");
    } else if (ruleId && existing && name === null) {
      setName(existing.name);
      setBranches(existing.branches as DraftBranch[]);
      setFallback(existing.fallback as Action);
    }
  }, [ruleId, existing, name]);

  if (name === null || branches === null || fallback === null) {
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

  const onSave = async () => {
    if (ruleId) {
      await update({
        ruleId: ruleId as any,
        name,
        branches,
        fallback,
      });
    } else if (role.schoolId) {
      await create({
        schoolId: role.schoolId as any,
        name,
        branches,
        fallback,
      });
    }
    navigation.goBack();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <Text style={labelStyle}>Name</Text>
      <TextInput value={name} onChangeText={setName} style={inputStyle} />
      <Text style={[labelStyle, { marginTop: space[4] }]}>
        Branches (first match wins)
      </Text>
      {branches.map((b, i) => (
        <BranchRow
          key={i}
          branch={b}
          onChange={(next) =>
            setBranches(branches.map((x, j) => (j === i ? next : x)))
          }
          onRemove={() => setBranches(branches.filter((_, j) => j !== i))}
        />
      ))}
      <PressableButton
        variant="ghost"
        onPress={() =>
          setBranches([
            ...branches,
            { condition: { minHire: 1 }, action: "advance" },
          ])
        }
      >
        Add branch
      </PressableButton>
      <Text style={[labelStyle, { marginTop: space[4] }]}>Fallback action</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {ACTIONS.map((a) => (
          <Pressable key={a} onPress={() => setFallback(a)}>
            <Text style={chipStyle(fallback === a)}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Text
        style={{
          color: colors.inkTertiary,
          fontSize: fonts.size.xs,
          marginTop: space[3],
        }}
      >
        Mobile editor supports minHire + maxReject conditions only. Use the web
        editor for minAverage and requiredRoles.
      </Text>
      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="primary" onPress={onSave}>
          Save
        </PressableButton>
      </View>
    </ScrollView>
  );
}

const labelStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.hairline,
  borderWidth: 1,
  borderRadius: radii.apple,
  padding: space[3],
  color: colors.ink,
  marginTop: space[1],
  fontSize: fonts.size.md,
} as const;

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    overflow: "hidden" as const,
  };
}
