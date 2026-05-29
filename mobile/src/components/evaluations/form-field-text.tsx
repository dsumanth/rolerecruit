import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "@/theme";

export function TextField({
  label,
  value,
  onChange,
  allowDictation = false,
  onMicPress,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  allowDictation?: boolean;
  onMicPress?: () => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space[2] }}>
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{label}</Text>
        {allowDictation && onMicPress && (
          <Pressable
            accessibilityLabel="dictate"
            accessibilityRole="button"
            onPress={onMicPress}
            style={{
              width: 36, height: 36, borderRadius: radii.pill,
              backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="mic" size={18} color={colors.accent} />
          </Pressable>
        )}
      </View>
      <TextInput
        placeholder="Type your notes..."
        placeholderTextColor={colors.inkTertiary}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1, borderColor: colors.hairline,
          borderRadius: radii.apple, padding: space[3],
          fontSize: fonts.size.md, color: colors.ink,
          backgroundColor: colors.surface, minHeight: 100,
        }}
      />
    </View>
  );
}
