import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { FieldRow, type DraftField } from "@/components/settings/field-row";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

type Role = "principal" | "hod" | "hr_admin" | "teacher";

export function TemplateEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const role = useRoleContext();
  const target = route.params.role as Role;

  const active = useQuery(
    api.formTemplates.getForRole,
    role.schoolId ? { schoolId: role.schoolId as any, role: target } : "skip",
  );
  const defaultDraft = useQuery(
    api.formTemplates.duplicateFromDefault,
    role.schoolId ? { schoolId: role.schoolId as any, role: target } : "skip",
  );
  const save = useMutation(api.formTemplates.saveOverride);

  const [name, setName] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[] | null>(null);

  useEffect(() => {
    if (active && name === null) {
      setName(active.name);
      setFields(active.fields as DraftField[]);
    }
  }, [active, name]);

  if (name === null || fields === null) {
    return (
      <View
        style={{
          flex: 1,
          padding: space[4],
          backgroundColor: colors.surfaceCanvas,
        }}
      >
        <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  const updateField = (i: number, next: DraftField) => {
    const copy = fields.slice();
    copy[i] = next;
    setFields(copy);
  };

  const removeField = (i: number) =>
    setFields(fields.filter((_, idx) => idx !== i));

  const moveField = (i: number, delta: -1 | 1) => {
    const to = i + delta;
    if (to < 0 || to >= fields.length) return;
    const copy = fields.slice();
    const [m] = copy.splice(i, 1);
    copy.splice(to, 0, m);
    setFields(copy);
  };

  const onSave = async () => {
    if (!role.schoolId) return;
    await save({
      schoolId: role.schoolId as any,
      role: target,
      name,
      fields,
    });
    navigation.goBack();
  };

  const startFromDefault = () => {
    if (!defaultDraft) return;
    setName(defaultDraft.name);
    setFields(defaultDraft.fields as DraftField[]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <Text style={labelStyle}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.hairline,
          borderWidth: 1,
          borderRadius: radii.apple,
          padding: space[3],
          color: colors.ink,
          marginTop: space[1],
          marginBottom: space[4],
        }}
      />
      {fields.map((f, i) => (
        <FieldRow
          key={`${f.key}-${i}`}
          field={f}
          onChange={(next) => updateField(i, next)}
          onRemove={() => removeField(i)}
          onMove={(d) => moveField(i, d)}
        />
      ))}
      <View style={{ marginTop: space[3], gap: space[2] }}>
        <PressableButton
          variant="ghost"
          onPress={() =>
            setFields([
              ...fields,
              {
                key: `field${fields.length + 1}`,
                label: "New field",
                type: "score_1_5",
              },
            ])
          }
        >
          Add field
        </PressableButton>
        <PressableButton variant="ghost" onPress={startFromDefault}>
          Reset to default
        </PressableButton>
        <PressableButton variant="primary" onPress={onSave}>
          Save
        </PressableButton>
      </View>
    </ScrollView>
  );
}

const labelStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};
