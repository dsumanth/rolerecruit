import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { PressableButton } from "@/components/ui/pressable-button";
import { authClient } from "@/lib/auth-client";
import { colors, fonts, radii, space } from "@/theme";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter the email address tied to your school account.");
      return;
    }
    setBusy(true);
    try {
      await (authClient as any).signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: "rolerecruit://",
      });
      setSent(true);
    } catch (err) {
      Alert.alert("Could not send link", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
    >
      <View style={{ flex: 1, padding: space[6], justifyContent: "center" }}>
        <Text style={{ fontSize: fonts.size.xxl, fontWeight: fonts.weight.bold, color: colors.ink, marginBottom: space[2] }}>
          Rolerecruit
        </Text>
        <Text style={{ fontSize: fonts.size.md, color: colors.inkSecondary, marginBottom: space[6] }}>
          Sign in with a magic link.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.inkTertiary}
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.surface,
            borderRadius: radii.apple,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            fontSize: fonts.size.md,
            color: colors.ink,
            marginBottom: space[4],
          }}
        />

        <PressableButton onPress={send} disabled={busy}>
          {busy ? "Sending..." : "Send sign-in link"}
        </PressableButton>

        {sent && (
          <Text style={{ marginTop: space[4], color: colors.success, fontSize: fonts.size.sm }}>
            Check your inbox. The link opens Rolerecruit.
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
