import { Text, View } from "react-native";
import { PressableButton } from "@/components/ui/pressable-button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { colors, fonts, space } from "@/theme";

export function ProfileScreen() {
  const { user, signOut } = useSession();
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
      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="secondary" onPress={signOut}>
          Sign out
        </PressableButton>
      </View>
    </View>
  );
}
