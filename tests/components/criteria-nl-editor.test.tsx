import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CriteriaNaturalLanguageEditor } from "../../components/criteria/CriteriaNaturalLanguageEditor";

describe("CriteriaNaturalLanguageEditor", () => {
  it("calls onSave on blur with new text", () => {
    const onSave = vi.fn();
    render(<CriteriaNaturalLanguageEditor initialValue="" onSave={onSave} />);
    const ta = screen.getByPlaceholderText(/Describe the ideal candidate/);
    fireEvent.change(ta, { target: { value: "5 years" } });
    fireEvent.blur(ta);
    expect(onSave).toHaveBeenCalledWith("5 years");
  });
});
