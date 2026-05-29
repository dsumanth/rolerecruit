import { render, screen, fireEvent } from "@testing-library/react-native";
import { SignInScreen } from "@/screens/sign-in";

const mockMagicLink = jest.fn().mockResolvedValue({ data: { sent: true } });
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: { magicLink: (...args: any[]) => mockMagicLink(...args) },
  },
}));

describe("SignInScreen", () => {
  beforeEach(() => mockMagicLink.mockClear());

  it("calls signIn.magicLink with the entered email", async () => {
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "evaluator@school.com");
    fireEvent.press(screen.getByText("Send sign-in link"));
    expect(mockMagicLink).toHaveBeenCalledWith({
      email: "evaluator@school.com",
      callbackURL: "rolerecruit://",
    });
  });
});
