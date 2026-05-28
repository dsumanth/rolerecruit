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

import { groupByDay } from "@/hooks/use-calendar-demos";

describe("groupByDay", () => {
  it("groups demos by YYYY-MM-DD key derived from scheduledAt", () => {
    const t = new Date("2026-06-15T10:00:00").getTime();
    const t2 = new Date("2026-06-15T14:00:00").getTime();
    const t3 = new Date("2026-06-16T09:00:00").getTime();
    const out = groupByDay([
      { invite: { _id: "i1" } as any, demo: { _id: "d1", scheduledAt: t } as any },
      { invite: { _id: "i2" } as any, demo: { _id: "d2", scheduledAt: t2 } as any },
      { invite: { _id: "i3" } as any, demo: { _id: "d3", scheduledAt: t3 } as any },
    ]);
    const keys = Object.keys(out).sort();
    expect(keys).toEqual(["2026-06-15", "2026-06-16"]);
    expect(out["2026-06-15"].map((r) => r.invite._id)).toEqual(["i1", "i2"]);
    expect(out["2026-06-16"].map((r) => r.invite._id)).toEqual(["i3"]);
  });

  it("sorts each day's rows by time ascending", () => {
    const earlier = new Date("2026-06-15T08:00:00").getTime();
    const later = new Date("2026-06-15T16:00:00").getTime();
    const out = groupByDay([
      { invite: { _id: "later" } as any, demo: { _id: "d1", scheduledAt: later } as any },
      { invite: { _id: "earlier" } as any, demo: { _id: "d2", scheduledAt: earlier } as any },
    ]);
    expect(out["2026-06-15"].map((r) => r.invite._id)).toEqual(["earlier", "later"]);
  });
});
