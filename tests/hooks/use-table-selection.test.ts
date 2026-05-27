// tests/hooks/use-table-selection.test.ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSelection } from "../../hooks/use-table-selection";

describe("useTableSelection", () => {
  it("starts empty in ids mode", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    expect(result.current.mode.kind).toBe("ids");
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });

  it("toggles single ids and counts", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c"]); });
    act(() => { result.current.toggle("a"); });
    act(() => { result.current.toggle("c"); });
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(false);
    expect(result.current.count).toEqual({ kind: "ids", n: 2 });
  });

  it("shift-click selects a range over loaded ids", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c", "d", "e"]); });
    act(() => { result.current.toggle("b"); });
    act(() => { result.current.toggle("d", true); });
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.isSelected("c")).toBe(true);
    expect(result.current.isSelected("d")).toBe(true);
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("toggleAllLoaded selects all then deselects", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c"]); });
    act(() => { result.current.toggleAllLoaded(["a", "b", "c"]); });
    expect(result.current.count).toEqual({ kind: "ids", n: 3 });
    act(() => { result.current.toggleAllLoaded(["a", "b", "c"]); });
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });

  it("selectAllMatching switches to all-matching mode", () => {
    const { result } = renderHook(() => useTableSelection<string, { schoolId: string }>());
    act(() => { result.current.selectAllMatching({ schoolId: "s1" }); });
    expect(result.current.mode.kind).toBe("all-matching");
    expect(result.current.isSelected("any-id")).toBe(true);
  });

  it("toggle from all-matching mode returns to ids", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b"]); });
    act(() => { result.current.selectAllMatching({}); });
    act(() => { result.current.toggle("a"); });
    expect(result.current.mode.kind).toBe("ids");
  });

  it("shift-click range advances the anchor for subsequent shift-clicks", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c", "d", "e"]); });
    act(() => { result.current.toggle("a"); });               // anchor = a
    act(() => { result.current.toggle("c", true); });         // range a..c
    act(() => { result.current.toggle("e", true); });         // range c..e (anchor was advanced to c)
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.isSelected("c")).toBe(true);
    expect(result.current.isSelected("d")).toBe(true);
    expect(result.current.isSelected("e")).toBe(true);
  });

  it("clear returns to empty ids mode", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.selectAllMatching({}); });
    act(() => { result.current.clear(); });
    expect(result.current.mode.kind).toBe("ids");
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });
});
