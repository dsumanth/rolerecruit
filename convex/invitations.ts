import { mutation, query, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const create = mutation({
  args: {
    email: v.string(),
    role: v.string(),
    schoolId: v.id("schools"),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) =>
        q.and(
          q.eq(q.field("schoolId"), args.schoolId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existing) throw new Error("An active invitation already exists for this email");

    const token = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    const inviteId = await ctx.db.insert("invitations", {
      token,
      email: args.email,
      role: args.role,
      schoolId: args.schoolId,
      status: "pending",
      createdBy: args.createdBy,
      createdAt: now,
      expiresAt,
    });

    await ctx.scheduler.runAfter(0, internal.invitations.sendInviteEmail, {
      inviteId,
      token,
      email: args.email,
      role: args.role,
      schoolId: args.schoolId,
    });

    return inviteId;
  },
});

export const sendInviteEmail = internalAction({
  args: {
    inviteId: v.id("invitations"),
    token: v.string(),
    email: v.string(),
    role: v.string(),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/accept-invite/${args.token}`;

    const school = await ctx.runQuery(internal.schools.getInternal, {
      schoolId: args.schoolId,
    });
    const schoolName = school?.name ?? "the school";

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "RoleRecruit <noreply@rolerecruit.com>",
        to: args.email,
        subject: `You've been invited to join ${schoolName} on RoleRecruit`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d1d1f; margin-bottom: 16px;">You've been invited!</h2>
            <p style="color: #86868b; line-height: 1.6;">
              You've been invited to join <strong style="color: #1d1d1f;">${schoolName}</strong>
              as a <strong style="color: #1d1d1f;">${args.role}</strong> on RoleRecruit.
            </p>
            <div style="margin: 32px 0;">
              <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #0071e3; color: white; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #aeaeb2; font-size: 12px; line-height: 1.6;">
              This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send invite email:", err);
      return;
    }
  },
});

export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_schoolId_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("status", "pending")
      )
      .collect();
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("invitations") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") throw new Error("Cannot revoke this invitation");
    await ctx.db.patch(args.inviteId, { status: "revoked" });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) return null;

    const school = await ctx.db.get(invite.schoolId);

    return {
      token: invite.token,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      schoolName: school?.name ?? "Unknown School",
    };
  },
});

export const accept = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) throw new Error("Invitation not found");
    if (invite.status !== "pending") throw new Error("Invitation is no longer valid");

    if (Date.now() > invite.expiresAt) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    if (invite.email.toLowerCase() !== args.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address");
    }

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existingProfile) {
      if (existingProfile.schoolId === invite.schoolId) {
        throw new Error("You are already a member of this school");
      }
      throw new Error("You already belong to a different school");
    }

    await ctx.db.insert("userProfiles", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      schoolId: invite.schoolId,
      role: invite.role,
    });

    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedBy: args.userId,
    });

    return { schoolId: invite.schoolId, role: invite.role };
  },
});
