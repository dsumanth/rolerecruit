import { renderHook } from "@testing-library/react-native";

jest.mock("convex/react", () => ({
  useMutation: () => jest.fn(),
  useQuery: () => undefined,
}));

jest.mock("@/hooks/use-session", () => ({
  useSession: () => ({ signedIn: false, user: null, session: null }),
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users:getProfile" },
    evaluationInvites: { listForUser: "evaluationInvites:listForUser" },
  },
}));

import { splitInvites } from "@/hooks/use-inbox";

const now = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("splitInvites", () => {
  it("classifies a live demo currently in progress as open-now", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "live", durationMinutes: 30,
        scheduledAt: now - 5 * 60_000, createdAt: now - DAY,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
    expect(out.upcoming).toHaveLength(0);
  });

  it("classifies a future-only live demo as upcoming", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: { _id: "d1", mode: "live", durationMinutes: 30, scheduledAt: now + 2 * HOUR, createdAt: now } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.upcoming.map((i) => i.invite._id)).toEqual(["i1"]);
    expect(out.openNow).toHaveLength(0);
  });

  it("classifies async demos as open-now between createdAt and scheduledAt + formCloseDueDays", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "async", durationMinutes: 0,
        scheduledAt: now + DAY, createdAt: now - HOUR, formCloseDueDays: 3,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
  });

  it("classifies post-mode demos as open-now during the post window", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "post", durationMinutes: 30,
        scheduledAt: now - 60 * 60_000, // demo ended 30m ago
        createdAt: now - DAY, formOpenWindowMinutes: 60,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
  });

  it("filters out invites that have already been submitted or cancelled", () => {
    const items = [
      { invite: { _id: "i1", status: "submitted" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
      { invite: { _id: "i2", status: "cancelled" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
      { invite: { _id: "i3", status: "declined" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
    ];
    const out = splitInvites(items, now);
    expect(out.openNow).toHaveLength(0);
    expect(out.upcoming).toHaveLength(0);
  });
});
