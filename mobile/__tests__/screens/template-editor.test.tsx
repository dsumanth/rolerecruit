import { render, screen, fireEvent } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { role: "principal" } }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));

const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("getForRole")) {
      return {
        _id: "tpl1",
        schoolId: "s1",
        role: "principal",
        name: "Principal default",
        fields: [
          { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5" },
        ],
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      };
    }
    if (typeof name === "string" && name.includes("duplicateFromDefault")) {
      return { role: "principal", name: "Principal default (copy)", fields: [] };
    }
    return undefined;
  },
  useMutation: () => mockSave,
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    formTemplates: {
      getForRole: "formTemplates:getForRole",
      duplicateFromDefault: "formTemplates:duplicateFromDefault",
      saveOverride: "formTemplates:saveOverride",
    },
  },
}));

import { TemplateEditorScreen } from "@/screens/template-editor";

describe("TemplateEditorScreen", () => {
  beforeEach(() => mockSave.mockClear());

  it("renders the active template's fields", () => {
    render(<TemplateEditorScreen />);
    expect(screen.getByDisplayValue("Subject knowledge")).toBeTruthy();
  });

  it("invokes saveOverride on Save", async () => {
    render(<TemplateEditorScreen />);
    fireEvent.press(screen.getByText("Save"));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: "s1", role: "principal" }),
    );
  });
});
