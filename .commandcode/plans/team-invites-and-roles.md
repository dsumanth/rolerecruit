# Team Invitations & Role Management Plan

## Summary

Two features are missing from the app:
1. **Team Member Invitations** — No way to add/invite team members from the Team tab
2. **Role/Permission Management** — No ability to create custom roles or edit permissions

This plan adds both, using the existing Resend email integration and Clerk auth.

---

## Architecture Overview

| Component | Current | After |
|---|---|---|
| `userProfiles.role` | Union literal (4 values) | `v.string()` — dynamic |
| Permissions | Hardcoded `ROLE_ACCESS` in `role-gate.tsx` | DB-driven via `roles` table |
| Invitations | Doesn't exist | New `invitations` table + email flow |
| Role management | Doesn't exist | New Settings tab for roles |

**New tables:**
- `invitations` — token, email, role, schoolId, status, createdBy, createdAt, expiresAt, acceptedBy
- `roles` — schoolId, name, permissions[], isSystem

**Flow**: Admin sends invite → Resend email with link → Recipient signs up/signs in via Clerk → Accept invite → Profile created with assigned role

---

## Phase 1: Schema & Convex Backend

### 1.1 `convex/schema.ts` — Add tables, relax role constraint

- Change `userProfiles.role` from union literal to `v.string()`
- Add `invitations` table with indexes: `by_token`, `by_schoolId_status`, `by_email`
- Add `roles` table with index: `by_schoolId`

### 1.2 `convex/roles.ts` — NEW: role CRUD + lazy seeding

**Exports:**

| Function | Type | Purpose |
|---|---|---|
| `list` | query | List all roles for school; lazy-seeds 4 defaults if none exist |
| `create` | mutation | Create a custom role (name + permissions). Guards: duplicate name, hr_admin only |
| `update` | mutation | Update permissions on any role (system or custom). hr_admin only |
| `remove` | mutation | Delete custom role. Guards: must not be in use by any user, isSystem=false only |

**Default roles seeded on first `list` call (lazy migration for existing schools):**
| Name | Permissions |
|---|---|
| HR Admin | `["*"]` |
| Principal | `["dashboard", "jobs", "pipeline", "feedback", "talent"]` |
| HOD | `["pipeline", "feedback"]` |
| Viewer | `["dashboard"]` |

**Permission strings:**
- `*` — full access
- `dashboard` — view dashboard
- `jobs` — manage job postings
- `pipeline` — access candidate pipeline
- `feedback` — submit/view evaluations
- `talent` — access talent pool
- `team` — view team page
- `team:manage` — invite/remove team members
- `settings` — view settings
- `settings:manage` — edit school settings

### 1.3 `convex/schools.ts` — Seed default roles on school creation

In the `create` mutation, after inserting the school, insert the 4 default system roles.

### 1.4 `convex/users.ts` — Relax validators, add permissions query

**Changes:**
- `createProfile` and `updateRole`: change `role` arg from union literal to `v.string()`
- `updateRole`: add guard that the target role name exists in the `roles` table for the user's school
- Add `getPermissions` query: returns permission array for a user by looking up their role in the `roles` table

### 1.5 `convex/invitations.ts` — NEW: invite CRUD + email

**Exports:**

| Function | Type | Purpose |
|---|---|---|
| `create` | mutation | Create invitation, schedule email. Guards: no duplicate pending invites |
| `sendInviteEmail` | internalAction | Send email via Resend with accept link |
| `list` | query | List pending/active invitations for school |
| `revoke` | mutation | Set status to "revoked" |
| `getByToken` | query | Get invitation by token (for accept page) |
| `accept` | mutation | Process acceptance: create userProfile, mark invite accepted |

**accept mutation guards:**
- Invitation must exist and be "pending"
- Check expiry (mark expired if past)
- Invited email must match authenticated user's email
- User must not already have a profile in this school
- User must not already have a profile in a different school

### 1.6 `middleware.ts` — Add accept-invite to public routes

---

## Phase 2: Invitation UI

### 2.1 `app/accept-invite/[token]/page.tsx` — NEW: Accept Invite Page (server component)

Server component using `fetchQuery` to read invite data without auth. Passes to client component.

### 2.2 `app/accept-invite/[token]/AcceptInviteClient.tsx` — NEW: Client Component

States:
1. **Expired/Revoked/Accepted**: Show message
2. **Not Signed In**: Show invite details + "Sign In" / "Sign Up" with redirect_url
3. **Signed In, Email Mismatch**: Error message
4. **Signed In, Email Match**: "Accept Invitation" button → accept mutation → redirect to /dashboard

### 2.3 `app/dashboard/team/page.tsx` — Add Invite UI

Above the existing team table, add:
- **Invite Member Section** (gated with `team:manage`): email input, role dropdown (from `api.roles.list`), send button
- **Pending Invitations Section**: table with email, role, date, revoke button

### 2.4 `components/dashboard/sidebar.tsx` — Update RoleGate actions

- Team nav item: `"*"` → `"team"`
- Settings nav item: `"*"` → `"settings"`

---

## Phase 3: Role Management UI

### 3.1 `components/auth/role-gate.tsx` — DB-driven permissions

- Remove hardcoded `ROLE_ACCESS` map
- `RoleGate` queries `api.users.getPermissions` from DB
- `RoleBadge` uses role name as-is

### 3.2 `app/dashboard/settings/roles/page.tsx` — NEW: Role Management Page

Role management page with:
- **System Roles**: show 4 default roles, not deletable but permissions editable
- **Custom Roles**: create/edit/delete custom roles
- **Permission editor**: checkbox grid for each permission string
- **Add Role button**: name input + permission checkboxes

### 3.3 `components/dashboard/sidebar.tsx` — Add Roles nav item

Add sub-item under Settings: "Roles & Permissions"

---

## Phase 4: App-Wide Adjustments

### 4.1 Audit all RoleGate usages

- Team page inline `profile?.role === "hr_admin"` → use permission-based check
- Any other hardcoded role checks → use permissions

### 4.2 Team page role dropdown

Change from hardcoded `ROLE_OPTIONS` to dynamic fetch from `api.roles.list`

---

## Verification Checklist

1. Schema migration works, existing userProfiles still valid
2. Lazy seeding: existing schools get 4 default roles on first access
3. New school seeding: onboarding creates school + 4 roles atomically
4. Invite end-to-end: send email → click link → sign up → profile created with correct role
5. Email mismatch: sign up with wrong email → error shown
6. Duplicate invite: same email twice → error
7. Revoke: create then revoke → accept page shows "no longer valid"
8. Expired: past expiry → accept page shows expired
9. Role editing: change Principal permissions → verify in app
10. Custom role: create, assign, verify permissions
11. Delete role: in-use → error; not in use → success
12. Name collision: create "HR Admin" → error
13. Permission sidebar: custom role with only "dashboard" → only Dashboard visible

---

## Files Changed (in order)

| Phase | File | Action |
|---|---|---|
| 1 | `convex/schema.ts` | Modify: add tables, change role type |
| 1 | `convex/roles.ts` | Create: CRUD + seeding |
| 1 | `convex/schools.ts` | Modify: seed roles on creation |
| 1 | `convex/users.ts` | Modify: relax validators, add getPermissions |
| 1 | `convex/invitations.ts` | Create: invite CRUD + email |
| 1 | `middleware.ts` | Modify: add public route |
| 2 | `app/accept-invite/[token]/page.tsx` | Create: server component |
| 2 | `app/accept-invite/[token]/AcceptInviteClient.tsx` | Create: client component |
| 2 | `app/dashboard/team/page.tsx` | Modify: add invite form + pending list |
| 3 | `components/auth/role-gate.tsx` | Modify: DB-driven permissions |
| 3 | `app/dashboard/settings/roles/page.tsx` | Create: role management UI |
| 4 | `components/dashboard/sidebar.tsx` | Modify: update RoleGate actions |
| 4 | `app/onboarding/page.tsx` | Verify: role name matches seeded role |
| 4 | `lib/constants.ts` | Clean up: remove USER_ROLES if unused |

---

## Edge Cases

- **Backward compat**: `v.string()` accepts existing role values like `"hr_admin"`
- **Lazy migration**: No explicit migration needed; `roles.list` auto-seeds on first call
- **Email mismatch**: Accept rejects if Clerk email != invited email
- **Multi-school**: For now, users cannot belong to multiple schools
- **hr_admin safety**: Consider preventing removal of `*` from HR Admin role
- **Deleted role in use**: `remove` checks for active assignments before deleting
- **Email failure**: `sendInviteEmail` is best-effort via scheduler; invite creation doesn't depend on email success
