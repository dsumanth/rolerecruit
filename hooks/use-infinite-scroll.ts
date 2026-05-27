// hooks/use-infinite-scroll.ts
import { useCallback, useEffect, useRef } from "react";

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

interface Params {
  status: PaginationStatus;
  loadMore: (n: number) => void;
  loadCount?: number;
}

export function useInfiniteScroll({ status, loadMore, loadCount = 100 }: Params) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setSentinel = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && status === "CanLoadMore") {
          loadMore(loadCount);
        }
      }
    }, { rootMargin: "200px" });
    observerRef.current.observe(node);
  }, [status, loadMore, loadCount]);

  useEffect(() => {
    return () => { observerRef.current?.disconnect(); };
  }, []);

  return setSentinel;
}
