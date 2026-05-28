import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

export function DeclineModal({
  inviteId,
  onClose,
}: {
  inviteId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const decline = useMutation(api.evaluationInvites.decline);

  async function confirm() {
    setBusy(true);
    try {
      await decline({ inviteId: inviteId as any, reason: reason.trim() || undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, color: colors.ink, marginBottom: space[2] }}>
          Decline this invite?
        </Text>
        <Text style={{ fontSize: fonts.size.sm, color: colors.inkSecondary, marginBottom: space[4] }}>
          Your school's HR will be notified so they can swap in another evaluator.
        </Text>
        <TextInput
          placeholder="Why are you declining?"
          placeholderTextColor={colors.inkTertiary}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radii.apple,
            padding: space[3],
            fontSize: fonts.size.md,
            color: colors.ink,
            marginBottom: space[4],
            backgroundColor: colors.surface,
            minHeight: 80,
          }}
        />
        <PressableButton variant="danger" onPress={confirm} disabled={busy}>
          {busy ? "Declining..." : "Confirm decline"}
        </PressableButton>
        <View style={{ marginTop: space[3] }}>
          <PressableButton variant="ghost" onPress={onClose}>
            Cancel
          </PressableButton>
        </View>
      </Card>
    </View>
  );
}
