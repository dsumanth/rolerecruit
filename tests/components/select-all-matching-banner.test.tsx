import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectAllMatchingBanner } from "../../components/ui/select-all-matching-banner";

describe("SelectAllMatchingBanner", () => {
  it("shows total and triggers onSelectAllMatching", () => {
    const onAll = vi.fn();
    render(
      <SelectAllMatchingBanner
        loadedCount={100}
        totalCount={2345}
        entityLabel="candidates"
        onSelectAllMatching={onAll}
      />
    );
    expect(screen.getByText(/All 100 candidates on this page selected/)).toBeDefined();
    fireEvent.click(screen.getByText(/Select all 2,345 matching/));
    expect(onAll).toHaveBeenCalledOnce();
  });

  it("is hidden when totalCount equals loadedCount", () => {
    const { container } = render(
      <SelectAllMatchingBanner
        loadedCount={5}
        totalCount={5}
        entityLabel="candidates"
        onSelectAllMatching={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
