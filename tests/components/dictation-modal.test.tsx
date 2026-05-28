import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DictationModal } from "../../components/evaluations/dictation-modal";

describe("DictationModal", () => {
  it("when unsupported, shows the fallback message", () => {
    render(
      <DictationModal
        open
        onClose={() => {}}
        fieldKey="comments"
        onComplete={() => {}}
        supportOverride={false}
      />,
    );
    expect(
      screen.getByText(/dictation requires chrome, edge, or safari/i),
    ).toBeInTheDocument();
  });

  it("when supported, finalizing transcript triggers onComplete with the summary", async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    const summarize = vi.fn(async () => ({
      summaryPoints: ["Good", "Engaged"],
      language: "en-IN",
    }));
    render(
      <DictationModal
        open
        onClose={onClose}
        fieldKey="comments"
        onComplete={onComplete}
        summarize={summarize}
        supportOverride={true}
        initialTranscript="The candidate was strong on fractions"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /tap to stop/i }));
    expect(summarize).toHaveBeenCalledWith({
      transcript: "The candidate was strong on fractions",
      fieldKey: "comments",
      language: expect.any(String),
      durationSec: expect.any(Number),
    });
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: "comments",
        transcript: "The candidate was strong on fractions",
        summaryPoints: ["Good", "Engaged"],
      }),
    );
  });
});
