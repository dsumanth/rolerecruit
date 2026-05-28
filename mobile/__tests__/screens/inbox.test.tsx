import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { InboxScreen } from "@/screens/inbox";

const mockOpenNowRow = {
  invite: { _id: "i1", status: "invited" } as any,
  demo: { _id: "d1", mode: "live", scheduledAt: Date.now() - 5 * 60_000, durationMinutes: 30, createdAt: 0 } as any,
  candidate: { name: "Priya", subject: "Maths" } as any,
};
const mockUpcomingRow = {
  invite: { _id: "i2", status: "invited" } as any,
  demo: { _id: "d2", mode: "post", scheduledAt: Date.now() + 2 * 3_600_000, durationMinutes: 30, createdAt: 0 } as any,
  candidate: { name: "Karan", subject: "Science" } as any,
};

jest.mock("@/hooks/use-inbox", () => ({
  useInbox: () => ({ loading: false, openNow: [mockOpenNowRow], upcoming: [mockUpcomingRow] }),
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("InboxScreen", () => {
  it("renders Open now and Upcoming section headers and their cards", () => {
    render(withNav(<InboxScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />));
    expect(screen.getByText("Open now")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Karan")).toBeTruthy();
  });
});
