import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { useSession } from "@/hooks/use-session";
import { useRoleContext } from "@/hooks/use-role-context";
import { colors, fonts, space } from "@/theme";

export function ProfileScreen() {
  const { user, signOut } = useSession();
  const role = useRoleContext();
  const navigation = useNavigation<any>();
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");

  useEffect(() => {
    (async () => {
      const res = (await Notifications.getPermissionsAsync()) as { status: string };
      setPermission(res.status as "granted" | "denied" | "undetermined");
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, padding: space[4] }}>
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, color: colors.ink }}>
          {user?.name ?? "Account"}
        </Text>
        <Text style={{ fontSize: fonts.size.sm, color: colors.inkSecondary, marginTop: space[1] }}>
          {user?.email ?? ""}
        </Text>
      </Card>

      <Card padding="md" style={{ marginTop: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
              Push notifications
            </Text>
            <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: 2 }}>
              We notify you when a form opens or an invite changes.
            </Text>
          </View>
          {permission === "granted" ? (
            <Badge tone="success">Enabled</Badge>
          ) : permission === "denied" ? (
            <Badge tone="danger">Disabled</Badge>
          ) : (
            <Badge tone="neutral">Not asked</Badge>
          )}
        </View>
        {permission === "denied" && (
          <View style={{ marginTop: space[3] }}>
            <PressableButton variant="ghost" onPress={() => Linking.openSettings()}>
              Open settings
            </PressableButton>
          </View>
        )}
      </Card>

      {role.isHR && (
        <View style={{ marginTop: space[4] }}>
          <PressableButton
            variant="secondary"
            onPress={() => navigation.navigate("Settings")}
          >
            Settings
          </PressableButton>
        </View>
      )}

      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="secondary" onPress={signOut}>
          Sign out
        </PressableButton>
      </View>
    </View>
  );
}
