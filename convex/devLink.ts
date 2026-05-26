/**
 * DEV-ONLY one-off action to link your Clerk user to a school by slug.
 *
 * Use case: after `seed:seedE2E` creates "Test School", you visit /dashboard/triage
 * and see no candidates — because your real userProfile points to your OWN school,
 * not Test School. This action repoints your userProfile.
 *
 * Usage:
 *   npx convex run devLink:linkMeToSchool '{"slug":"test-school"}'
 *
 * Prints your original schoolId so you can restore with:
 *   npx convex run devLink:linkMeToSchool '{"schoolId":"<original-id>"}'
 *
 * Safety:
 *   - Refuses to run if more than one userProfile exists (would have to pick).
 *   - Refuses if zero exist (nothing to relink).
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const linkMeToSchool = internalAction({
  args: {
    slug: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<{
    userProfileId: Id<"userProfiles">;
    clerkUserId: string;
    previousSchoolId: Id<"schools">;
    newSchoolId: Id<"schools">;
    schoolName: string;
  }> => {
    if (!args.slug && !args.schoolId) {
      throw new Error("Pass either `slug` or `schoolId`");
    }

    // Find the target school
    let targetSchoolId: Id<"schools">;
    if (args.schoolId) {
      targetSchoolId = args.schoolId;
    } else {
      const school = await ctx.runQuery(api.careers.getSchoolBySlug, { slug: args.slug! });
      if (!school) throw new Error(`No school with slug "${args.slug}"`);
      targetSchoolId = school._id;
    }

    // Find existing userProfiles
    const profiles = await ctx.runQuery(internal.devLink.listAllProfiles, {});
    if (profiles.length === 0) {
      throw new Error("No userProfiles exist. Sign in to the app first to create your profile.");
    }
    if (profiles.length > 1) {
      throw new Error(
        `Multiple userProfiles exist (${profiles.length}). Refusing to guess which one is yours. ` +
        `Profiles: ${profiles.map((p) => `${p._id} (clerkId=${p.userId}, school=${p.schoolId})`).join("; ")}`
      );
    }

    const me = profiles[0];
    const previousSchoolId = me.schoolId;

    if (previousSchoolId === targetSchoolId) {
      const school = await ctx.runQuery(internal.devLink.getSchool, { schoolId: targetSchoolId });
      return {
        userProfileId: me._id,
        clerkUserId: me.userId,
        previousSchoolId,
        newSchoolId: targetSchoolId,
        schoolName: school?.name ?? "(unknown)",
      };
    }

    await ctx.runMutation(internal.devLink.patchProfileSchool, {
      profileId: me._id,
      schoolId: targetSchoolId,
    });

    const school = await ctx.runQuery(internal.devLink.getSchool, { schoolId: targetSchoolId });

    return {
      userProfileId: me._id,
      clerkUserId: me.userId,
      previousSchoolId,
      newSchoolId: targetSchoolId,
      schoolName: school?.name ?? "(unknown)",
    };
  },
});

// Internal helpers — not exposed via public API
import { internalQuery, internalMutation } from "./_generated/server";

export const listAllProfiles = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("userProfiles").collect(),
});

export const getSchool = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => await ctx.db.get(args.schoolId),
});

export const patchProfileSchool = internalMutation({
  args: { profileId: v.id("userProfiles"), schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { schoolId: args.schoolId });
  },
});
