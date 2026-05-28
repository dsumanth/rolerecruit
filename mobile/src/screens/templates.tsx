import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;
type TemplateRole = (typeof ROLES)[number];

const LABELS: Record<TemplateRole, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export function TemplatesIndexScreen() {
  const role = useRoleContext();
  const navigation = useNavigation<any>();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      {ROLES.map((r) => (
        <RoleRow
          key={r}
          role={r}
          schoolId={role.schoolId}
          onPress={() => navigation.navigate("TemplateEditor", { role: r })}
        />
      ))}
    </ScrollView>
  );
}

interface RoleRowProps {
  role: TemplateRole;
  schoolId: string | null;
  onPress: () => void;
}

function RoleRow({ role, schoolId, onPress }: RoleRowProps) {
  const active = useQuery(
    api.formTemplates.getForRole,
    schoolId ? { schoolId: schoolId as any, role } : "skip",
  );
  const overridden = !!(active && (active as any).schoolId);
  return (
    <Pressable onPress={onPress} style={{ marginBottom: space[3] }}>
      <Card padding="md">
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                color: colors.ink,
                fontSize: fonts.size.md,
                fontWeight: fonts.weight.semibold,
              }}
            >
              {LABELS[role]}
            </Text>
            <Text
              style={{
                color: colors.inkSecondary,
                fontSize: fonts.size.xs,
                marginTop: space[1],
              }}
            >
              {active?.name ?? "Loading..."}
            </Text>
          </View>
          <Badge tone={overridden ? "success" : "neutral"}>
            {overridden ? "Customized" : "Default"}
          </Badge>
        </View>
      </Card>
    </Pressable>
  );
}
