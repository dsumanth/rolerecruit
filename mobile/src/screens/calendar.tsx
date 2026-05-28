import { ScrollView, Text, View } from "react-native";
import { useCalendarDemos } from "@/hooks/use-calendar-demos";
import { InboxCard } from "@/components/inbox/inbox-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

function formatDayHeader(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function CalendarScreen({ navigation }: { navigation?: any; route?: any }) {
  const { days, loading } = useCalendarDemos();
  const dayKeys = Object.keys(days).sort();

  if (loading && dayKeys.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  if (dayKeys.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
        <EmptyState title="No demos yet" body="When you have demos scheduled, they appear here." />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
    >
      {dayKeys.map((key) => (
        <View key={key} style={{ marginBottom: space[6] }}>
          <Text
            style={{
              fontSize: fonts.size.sm,
              fontWeight: fonts.weight.semibold,
              color: colors.inkSecondary,
              marginBottom: space[2],
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {formatDayHeader(key)}
          </Text>
          {days[key].map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
