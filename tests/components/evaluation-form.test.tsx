import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvaluationForm } from "../../components/evaluations/evaluation-form";

const template = {
  _id: "t1" as any,
  name: "Principal default",
  role: "principal" as const,
  fields: [
    { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5" as const, required: true },
    { key: "comments", label: "Comments", type: "text" as const, allowDictation: true },
  ],
};

describe("EvaluationForm", () => {
  it("renders one input per template field", () => {
    render(<EvaluationForm template={template} onSubmit={() => {}} />);
    expect(screen.getByText("Subject knowledge")).toBeInTheDocument();
    expect(screen.getByLabelText("Comments")).toBeInTheDocument();
  });

  it("submits collected values and the recommendation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EvaluationForm template={template} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /score 4 for subject knowledge/i }));
    await user.type(screen.getByLabelText("Comments"), "Good lesson");
    await user.click(screen.getByRole("button", { name: /^hire$/i }));
    await user.click(screen.getByRole("button", { name: /submit evaluation/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      responses: { subjectKnowledge: 4, comments: "Good lesson" },
      recommendation: "hire",
      voiceInputs: [],
    });
  });

  it("blocks submit when a required field is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EvaluationForm template={template} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /submit evaluation/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/subject knowledge is required/i)).toBeInTheDocument();
  });
});
