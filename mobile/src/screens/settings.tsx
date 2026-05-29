import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Row {
  title: string;
  subtitle: string;
  target: string;
}

const ROWS: Row[] = [
  {
    title: "Form templates",
    subtitle: "Per-role evaluation forms",
    target: "Templates",
  },
  {
    title: "Decision rules",
    subtitle: "Auto-advance, reject, redemo",
    target: "DecisionRules",
  },
  {
    title: "Notifications",
    subtitle: "Manage push permission",
    target: "Profile",
  },
];

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      {ROWS.map((row) => (
        <Pressable
          key={row.target}
          onPress={() => navigation.navigate(row.target)}
          style={{ marginBottom: space[3] }}
        >
          <Card padding="md">
            <Text
              style={{
                color: colors.ink,
                fontSize: fonts.size.md,
                fontWeight: fonts.weight.semibold,
              }}
            >
              {row.title}
            </Text>
            <View>
              <Text
                style={{
                  color: colors.inkSecondary,
                  fontSize: fonts.size.sm,
                  marginTop: space[1],
                }}
              >
                {row.subtitle}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
