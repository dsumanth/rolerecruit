import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { HRTabs } from "@/navigation/hr-tabs";

jest.mock("@/screens/inbox", () => {
  const RN = require("react-native");
  return { InboxScreen: () => <RN.Text>InboxStub</RN.Text> };
});
jest.mock("@/screens/calendar", () => {
  const RN = require("react-native");
  return { CalendarScreen: () => <RN.Text>CalendarStub</RN.Text> };
});
jest.mock("@/screens/candidates", () => {
  const RN = require("react-native");
  return { CandidatesScreen: () => <RN.Text>CandidatesStub</RN.Text> };
});
jest.mock("@/screens/pipeline", () => {
  const RN = require("react-native");
  return { PipelineScreen: () => <RN.Text>PipelineStub</RN.Text> };
});
jest.mock("@/screens/profile", () => {
  const RN = require("react-native");
  return { ProfileScreen: () => <RN.Text>ProfileStub</RN.Text> };
});

describe("HRTabs", () => {
  it("renders the Inbox tab content by default and shows all five tab labels", () => {
    render(
      <NavigationContainer>
        <HRTabs />
      </NavigationContainer>,
    );

    expect(screen.getByText("InboxStub")).toBeTruthy();

    expect(screen.getAllByText("Inbox").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Candidates").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pipeline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
  });
});
