import { View, type ViewProps } from "react-native";
import { colors, radii, space } from "@/theme";

type Padding = "none" | "sm" | "md" | "lg";

export function Card({
  padding = "md",
  style,
  children,
  ...rest
}: ViewProps & { padding?: Padding }) {
  const padMap: Record<Padding, number> = {
    none: 0,
    sm: space[3],
    md: space[4],
    lg: space[6],
  };
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.apple,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: padMap[padding],
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
