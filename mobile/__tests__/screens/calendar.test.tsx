import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { CalendarScreen } from "@/screens/calendar";

const mockDay1 = "2026-06-15";
const mockDay2 = "2026-06-16";

jest.mock("@/hooks/use-calendar-demos", () => ({
  useCalendarDemos: () => ({
    loading: false,
    days: {
      [mockDay1]: [
        {
          invite: { _id: "i1", status: "invited" } as any,
          demo: { _id: "d1", mode: "live", scheduledAt: new Date(`${mockDay1}T10:00:00`).getTime(), durationMinutes: 30 } as any,
          candidate: { name: "Priya", subject: "Maths" } as any,
        },
      ],
      [mockDay2]: [
        {
          invite: { _id: "i2", status: "viewed" } as any,
          demo: { _id: "d2", mode: "post", scheduledAt: new Date(`${mockDay2}T09:00:00`).getTime(), durationMinutes: 30 } as any,
          candidate: { name: "Karan" } as any,
        },
      ],
    },
  }),
}));

describe("CalendarScreen", () => {
  it("renders one day header per group", () => {
    render(
      <NavigationContainer>
        <CalendarScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />
      </NavigationContainer>,
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Karan")).toBeTruthy();
  });
});
