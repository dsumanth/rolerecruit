import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

type Row = {
  invite: { _id: string; status: string };
  demo: { _id: string; mode: "live" | "post" | "async"; scheduledAt: number; durationMinutes: number };
  candidate?: { name?: string; subject?: string } | null;
};

const MODE_TONE: Record<Row["demo"]["mode"], "danger" | "warning" | "info"> = {
  live: "danger",
  post: "warning",
  async: "info",
};

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

export function InboxCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const name = row.candidate?.name ?? "Candidate";
  const subject = row.candidate?.subject;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card padding="md" style={{ marginBottom: space[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, color: colors.ink }}>
            {name}
          </Text>
          <Badge tone={MODE_TONE[row.demo.mode]}>{row.demo.mode.toUpperCase()}</Badge>
        </View>
        {subject && (
          <Text style={{ marginTop: space[1], color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            {subject}
          </Text>
        )}
        <Text style={{ marginTop: space[2], color: colors.inkTertiary, fontSize: fonts.size.xs }}>
          {formatWhen(row.demo.scheduledAt)}
        </Text>
      </Card>
    </Pressable>
  );
}
