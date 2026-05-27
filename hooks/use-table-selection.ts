// hooks/use-table-selection.ts
import { useCallback, useRef, useState } from "react";

export type SelectionMode<F> =
  | { kind: "ids"; selected: Set<string> }
  | { kind: "all-matching"; filter: F };

export interface UseTableSelectionResult<Id extends string, F> {
  mode: SelectionMode<F>;
  isSelected: (id: Id) => boolean;
  setLoadedIds: (ids: Id[]) => void;
  toggle: (id: Id, shiftKey?: boolean) => void;
  toggleAllLoaded: (ids: Id[]) => void;
  selectAllMatching: (filter: F) => void;
  clear: () => void;
  count: { kind: "ids"; n: number } | { kind: "all-matching"; n: number };
}

export function useTableSelection<Id extends string, F>(): UseTableSelectionResult<Id, F> {
  const [mode, setMode] = useState<SelectionMode<F>>({ kind: "ids", selected: new Set() });
  const loadedIdsRef = useRef<Id[]>([]);
  const lastToggledRef = useRef<Id | null>(null);

  const setLoadedIds = useCallback((ids: Id[]) => {
    loadedIdsRef.current = ids;
  }, []);

  const isSelected = useCallback(
    (id: Id) => mode.kind === "all-matching" ? true : mode.selected.has(id),
    [mode],
  );

  const toggle = useCallback((id: Id, shiftKey = false) => {
    setMode((prev) => {
      const base = prev.kind === "ids" ? new Set(prev.selected) : new Set<string>();
      if (shiftKey && lastToggledRef.current && loadedIdsRef.current.length > 0) {
        const all = loadedIdsRef.current;
        const a = all.indexOf(lastToggledRef.current);
        const b = all.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) base.add(all[i]);
          return { kind: "ids", selected: base };
        }
      }
      if (base.has(id)) base.delete(id);
      else base.add(id);
      lastToggledRef.current = id;
      return { kind: "ids", selected: base };
    });
  }, []);

  const toggleAllLoaded = useCallback((ids: Id[]) => {
    setMode((prev) => {
      const base = prev.kind === "ids" ? new Set(prev.selected) : new Set<string>();
      const allSelected = ids.every((id) => base.has(id));
      if (allSelected) ids.forEach((id) => base.delete(id));
      else ids.forEach((id) => base.add(id));
      return { kind: "ids", selected: base };
    });
  }, []);

  const selectAllMatching = useCallback((filter: F) => {
    setMode({ kind: "all-matching", filter });
  }, []);

  const clear = useCallback(() => {
    setMode({ kind: "ids", selected: new Set() });
    lastToggledRef.current = null;
  }, []);

  const count = mode.kind === "ids"
    ? { kind: "ids" as const, n: mode.selected.size }
    : { kind: "all-matching" as const, n: -1 };

  return { mode, isSelected, setLoadedIds, toggle, toggleAllLoaded, selectAllMatching, clear, count };
}
