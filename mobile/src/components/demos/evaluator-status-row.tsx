import { Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

const STATUS_TONE: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  invited: "neutral",
  viewed: "info",
  in_progress: "warning",
  submitted: "success",
  declined: "danger",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  viewed: "Viewed",
  in_progress: "In progress",
  submitted: "Submitted",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function EvaluatorStatusRow({ name, role, status }: { name: string; role: string; status: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <View>
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
          {name}
        </Text>
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: 2 }}>
          {role.toUpperCase()}
        </Text>
      </View>
      <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
    </View>
  );
}
