import { render, screen, fireEvent } from "@testing-library/react-native";
import { InboxCard } from "@/components/inbox/inbox-card";

const baseDemo = {
  _id: "d1" as any,
  mode: "live" as const,
  scheduledAt: 1_700_000_000_000,
  durationMinutes: 30,
  createdAt: 0,
};

describe("InboxCard", () => {
  it("shows the candidate name, subject, and mode badge", () => {
    render(
      <InboxCard
        row={{
          invite: { _id: "i1" as any, status: "invited" } as any,
          demo: baseDemo,
          candidate: { name: "Priya", subject: "Maths" } as any,
        }}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Maths")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("invokes onPress when tapped", () => {
    const onPress = jest.fn();
    render(
      <InboxCard
        row={{
          invite: { _id: "i1" as any, status: "invited" } as any,
          demo: baseDemo,
          candidate: { name: "Priya" } as any,
        }}
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByText("Priya"));
    expect(onPress).toHaveBeenCalled();
  });
});
