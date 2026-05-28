import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";
import { colors, radii, space, fonts } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface PressableButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}

export function PressableButton({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onPress,
  ...rest
}: PressableButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        { paddingHorizontal: s.padH, paddingVertical: s.padV },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
      {...rest}
    >
      <Text style={[styles.label, { color: v.text, fontSize: s.font }]}>{children}</Text>
    </Pressable>
  );
}

const variantStyles: Record<Variant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.accent, text: colors.inverse, border: colors.accent },
  secondary: { bg: colors.surface, text: colors.ink, border: colors.hairline },
  ghost: { bg: "transparent", text: colors.accent, border: "transparent" },
  danger: { bg: colors.danger, text: colors.inverse, border: colors.danger },
};

const sizeStyles: Record<Size, { padH: number; padV: number; font: number }> = {
  sm: { padH: space[3], padV: space[1] + 2, font: fonts.size.sm },
  md: { padH: space[4], padV: space[2] + 2, font: fonts.size.md },
  lg: { padH: space[5], padV: space[3], font: fonts.size.lg },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: fonts.weight.semibold,
    textAlign: "center",
  },
});
