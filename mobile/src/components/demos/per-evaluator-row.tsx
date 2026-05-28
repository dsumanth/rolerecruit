import { Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

interface Props {
  name: string;
  role: string;
  status: string;
  recommendation?: "hire" | "maybe" | "reject";
  bullets?: string[];
}

export function PerEvaluatorRow({ name, role, status, recommendation, bullets }: Props) {
  const recTone: "success" | "warning" | "danger" | "neutral" =
    recommendation === "hire"
      ? "success"
      : recommendation === "maybe"
        ? "warning"
        : recommendation === "reject"
          ? "danger"
          : "neutral";
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
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
            {name}
          </Text>
          <Text
            style={{
              color: colors.inkSecondary,
              fontSize: fonts.size.xs,
              marginTop: 2,
            }}
          >
            {role}
          </Text>
        </View>
        {recommendation ? (
          <Badge tone={recTone}>{recommendation}</Badge>
        ) : (
          <Badge tone="neutral">{status}</Badge>
        )}
      </View>
      {bullets && bullets.length > 0 && (
        <View style={{ marginTop: space[2] }}>
          {bullets.map((b, i) => (
            <Text
              key={i}
              style={{
                color: colors.inkSecondary,
                fontSize: fonts.size.sm,
                marginTop: 2,
              }}
            >
              {`• ${b}`}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}
