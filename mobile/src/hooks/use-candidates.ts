import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export interface CandidateRow {
  _id: string;
  candidateId?: string;
  applicationId?: string;
  name: string;
  email?: string;
  subjects?: string[];
}

interface Options {
  schoolId: string | null;
  initialSearch?: string;
  pageSize?: number;
}

const SEARCH_DEBOUNCE_MS = 200;

export function useCandidates({ schoolId, initialSearch = "", pageSize = 25 }: Options) {
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);
  const { results, status, loadMore } = usePaginatedQuery(
    api.candidates.listForSchool,
    schoolId
      ? {
          schoolId: schoolId as any,
          filter: { search: debouncedSearch || undefined },
        }
      : "skip",
    { initialNumItems: pageSize },
  );
  const rawRows = (results ?? []) as Array<Record<string, unknown>>;
  const rows: CandidateRow[] = rawRows.map((r) => ({
    _id: (r._id ?? r.candidateId) as string,
    candidateId: r.candidateId as string | undefined,
    applicationId: r.applicationId as string | undefined,
    name: (r.name ?? "") as string,
    email: r.email as string | undefined,
    subjects: r.subjects as string[] | undefined,
  }));
  return {
    rows,
    status,
    loading: status === "LoadingFirstPage",
    loadMore: () => loadMore(pageSize),
    search,
    setSearch,
  };
}
