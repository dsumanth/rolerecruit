"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { RoleBadge } from "@/components/auth/role-gate";
import { useState, useEffect } from "react";

export default function TeamSettingsPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const members = useQuery(api.users.getBySchool, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const roles = useQuery(api.roles.list, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const invitations = useQuery(api.invitations.list, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const permissions = useQuery(api.users.getPermissions, user?.id ? { userId: user.id } : "skip");
  const updateRole = useMutation(api.users.updateRole);
  const createInvite = useMutation(api.invitations.create);
  const revokeInvite = useMutation(api.invitations.revoke);
  const seedDefaults = useMutation(api.roles.seedDefaults);

  const [seeded, setSeeded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const canManageTeam = permissions?.includes("*") || permissions?.includes("team:manage");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.schoolId || !inviteEmail || !inviteRole) return;
    setInviteError("");
    setInviteSuccess(false);
    setInviting(true);

    try {
      await createInvite({
        createdBy: user?.id ?? "",
        email: inviteEmail,
        role: inviteRole,
        schoolId: profile.schoolId,
      });
      setInviteEmail("");
      setInviteRole("");
      setInviteSuccess(true);
    } catch (err: any) {
      setInviteError(err.message ?? "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    if (roles && roles.length === 0 && !seeded && profile?.schoolId) {
      setSeeded(true);
      seedDefaults({ schoolId: profile.schoolId });
    }
  }, [roles, seeded, profile?.schoolId, seedDefaults]);

  if (!members) return <p className="text-sm text-ink-secondary">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Team</h1>
          <p className="text-ink-secondary mt-1">Manage your school's hiring team and permissions.</p>
        </div>
      </div>

      {canManageTeam && (
        <div className="rounded-apple bg-surface border border-surface-tertiary p-5 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-4">Invite Team Member</h2>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-secondary mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-apple bg-surface-secondary border border-surface-tertiary text-sm"
                placeholder="colleague@school.edu"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 rounded-apple bg-surface-secondary border border-surface-tertiary text-sm min-w-[140px]"
                required
              >
                <option value="">Select role...</option>
                {roles?.map((r) => (
                  <option key={r._id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] disabled:opacity-50 transition-colors"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
          {inviteError && (
            <p className="mt-3 text-xs text-[#ff3b30]">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-3 text-xs text-[#34c759]">Invitation sent!</p>
          )}
        </div>
      )}

      {invitations && invitations.length > 0 && (
        <div className="rounded-apple bg-surface border border-surface-tertiary overflow-hidden mb-6">
          <div className="px-5 py-3 bg-[#fff9f0] border-b border-surface-tertiary">
            <h2 className="text-sm font-semibold text-ink">Pending Invitations</h2>
          </div>
          <div className="grid grid-cols-4 gap-4 px-5 py-2 bg-surface-secondary border-b border-surface-tertiary text-xs font-medium text-ink-secondary">
            <span>Email</span>
            <span>Role</span>
            <span>Invited</span>
            <span>Actions</span>
          </div>
          {invitations.map((inv) => (
            <div key={inv._id} className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-surface-tertiary last:border-b-0 items-center text-sm">
              <span className="text-ink">{inv.email}</span>
              <span><RoleBadge role={inv.role} /></span>
              <span className="text-xs text-ink-secondary">{new Date(inv.createdAt).toLocaleDateString()}</span>
              <span>
                {canManageTeam && (
                  <button
                    onClick={() => revokeInvite({ inviteId: inv._id })}
                    className="text-xs text-[#ff3b30] hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-apple bg-surface border border-surface-tertiary overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 bg-surface-secondary border-b border-surface-tertiary text-xs font-medium text-ink-secondary">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Actions</span>
        </div>

        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-secondary">
            No team members yet.
          </div>
        ) : (
          members.map((m) => (
            <div key={m.userId} className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-surface-tertiary last:border-b-0 items-center text-sm">
              <span className="text-ink font-medium">{m.name}</span>
              <span className="text-ink-secondary">{m.email || "N/A"}</span>
              <span>
                <RoleBadge role={m.role} />
              </span>
              <span>
                {canManageTeam && m.userId !== user?.id ? (
                  <select
                    value={m.role}
                    onChange={(e) => updateRole({ userId: m.userId, role: e.target.value })}
                    className="text-xs px-2 py-1 rounded bg-surface-secondary border border-surface-tertiary text-ink"
                  >
                    {roles?.map((r) => (
                      <option key={r._id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-ink-tertiary">
                    {m.userId === user?.id ? "You" : "Admin only"}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
