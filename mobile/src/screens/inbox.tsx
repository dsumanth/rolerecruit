import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useInbox } from "@/hooks/use-inbox";
import { InboxCard } from "@/components/inbox/inbox-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/app-nav";

type Props = NativeStackScreenProps<RootStackParamList, "EvaluatorTabs"> | { navigation: any; route: any };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space[6] }}>
      <Text style={{ fontSize: fonts.size.sm, fontWeight: fonts.weight.semibold, color: colors.inkSecondary, marginBottom: space[2], textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function InboxScreen({ navigation }: Props) {
  const { openNow, upcoming, loading } = useInbox();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    // Convex live queries refresh automatically; the pull-to-refresh just gives haptic feedback.
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }

  if (loading && openNow.length === 0 && upcoming.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Section title="Open now">
        {openNow.length === 0 ? (
          <EmptyState title="Nothing open" body="You'll see demos here when the form-open window starts." />
        ) : (
          openNow.map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))
        )}
      </Section>

      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming demos" body="When you're invited, your demos show up here." />
        ) : (
          upcoming.map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))
        )}
      </Section>
    </ScrollView>
  );
}
