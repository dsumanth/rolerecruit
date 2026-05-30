import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { PressableButton } from "@/components/ui/pressable-button";
import { authClient } from "@/lib/auth-client";
import { colors, fonts, radii, space } from "@/theme";

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.hairline,
  backgroundColor: colors.surface,
  borderRadius: radii.apple,
  paddingHorizontal: space[4],
  paddingVertical: space[3],
  fontSize: fonts.size.md,
  color: colors.ink,
  marginBottom: space[4],
} as const;

export function SignInScreen() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter the email address tied to your school account.");
      return;
    }
    setBusy(true);
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "sign-in",
      });
      setStep("code");
    } catch (err) {
      Alert.alert("Could not send code", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (code.trim().length < 6) {
      Alert.alert("Enter the code", "Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: code.trim(),
      });
      if (error) {
        Alert.alert("Invalid code", error.message ?? "Check the code and try again.");
      }
      // On success, the session updates and the app navigates automatically.
    } catch (err) {
      Alert.alert("Could not sign in", err instanceof Error ? err.message : "Try again");
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
          {step === "email" ? "Sign in with a one-time code." : `Enter the code we sent to ${email.trim().toLowerCase()}.`}
        </Text>

        {step === "email" ? (
          <>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.inkTertiary}
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <PressableButton onPress={sendCode} disabled={busy}>
              {busy ? "Sending..." : "Send code"}
            </PressableButton>
          </>
        ) : (
          <>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
              placeholderTextColor={colors.inkTertiary}
              value={code}
              onChangeText={setCode}
              maxLength={6}
              style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: fonts.size.xl }}
            />
            <PressableButton onPress={verifyCode} disabled={busy}>
              {busy ? "Verifying..." : "Verify & sign in"}
            </PressableButton>
            <View style={{ marginTop: space[3] }}>
              <PressableButton variant="ghost" onPress={() => { setCode(""); setStep("email"); }} disabled={busy}>
                Use a different email
              </PressableButton>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
