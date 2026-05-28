import { useCallback } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoleContext } from "@/hooks/use-role-context";
import { useCandidates, type CandidateRow } from "@/hooks/use-candidates";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, radii, space } from "@/theme";

export function CandidatesScreen() {
  const role = useRoleContext();
  const { rows, status, loadMore, search, setSearch } = useCandidates({
    schoolId: role.schoolId,
  });
  const navigation = useNavigation<any>();

  const renderItem = useCallback(
    ({ item }: { item: CandidateRow }) => (
      <CandidateCard
        name={item.name}
        email={item.email}
        subjects={item.subjects}
        onPress={() => navigation.navigate("CandidateDetail", { candidateId: item._id })}
      />
    ),
    [navigation],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <View style={{ padding: space[4], paddingBottom: space[2] }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search candidates"
          placeholderTextColor={colors.inkTertiary}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderWidth: 1,
            borderRadius: radii.apple,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            color: colors.ink,
            fontSize: fonts.size.md,
          }}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: space[4], paddingTop: 0 }}
        onEndReached={() => {
          if (status === "CanLoadMore") loadMore();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            title="No candidates yet"
            body="Add a candidate from the web to get started."
          />
        }
      />
    </View>
  );
}
