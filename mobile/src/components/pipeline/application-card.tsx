import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

interface Props {
  applicationId: string;
  candidateName: string;
  stage: string;
  matchScore?: number;
  onPress: () => void;
}

export function ApplicationCard({
  candidateName,
  stage,
  matchScore,
  onPress,
}: Props) {
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
          <Text
            style={{
              color: colors.ink,
              fontSize: fonts.size.md,
              fontWeight: fonts.weight.semibold,
            }}
          >
            {candidateName}
          </Text>
          {typeof matchScore === "number" && (
            <Badge tone="info">{`${Math.round(matchScore * 100)}%`}</Badge>
          )}
        </View>
        <Text
          style={{
            color: colors.inkSecondary,
            fontSize: fonts.size.sm,
            marginTop: space[1],
          }}
        >
          {stage.replace(/_/g, " ")}
        </Text>
      </Card>
    </Pressable>
  );
}
