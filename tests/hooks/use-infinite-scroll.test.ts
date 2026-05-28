import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInfiniteScroll } from "../../hooks/use-infinite-scroll";

describe("useInfiniteScroll", () => {
  it("returns a ref and does not call loadMore by default", () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ status: "CanLoadMore", loadMore })
    );
    expect(typeof result.current).toBe("function");
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("does not load when status is Exhausted", () => {
    const loadMore = vi.fn();
    renderHook(() =>
      useInfiniteScroll({ status: "Exhausted", loadMore })
    );
    expect(loadMore).not.toHaveBeenCalled();
  });
});
