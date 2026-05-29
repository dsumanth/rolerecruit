import { Pressable, ScrollView, Text } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

interface Stage {
  id: string;
  name: string;
}

interface Props {
  stages: Stage[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function StageChips({ stages, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2] }}
    >
      <Pressable onPress={() => onSelect(null)}>
        <Text style={chipStyle(selectedId === null)}>All</Text>
      </Pressable>
      {stages.map((s) => (
        <Pressable key={s.id} onPress={() => onSelect(s.id)}>
          <Text style={chipStyle(selectedId === s.id)}>{s.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.pill,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    overflow: "hidden" as const,
  };
}
