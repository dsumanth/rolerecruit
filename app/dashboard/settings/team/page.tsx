"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { RoleBadge } from "@/components/auth/role-gate";
import { useState, useEffect } from "react";
import { Button, Card, Input, Select } from "@/components/ui";

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

  if (!members) return <p className="text-body-s text-ink-secondary">Loading...</p>;

  const roleOptions = (roles ?? []).map((r: { name: string }) => ({ value: r.name, label: r.name }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title-l text-ink">Team</h1>
          <p className="text-body-s text-ink-secondary mt-1">Manage your school's hiring team and permissions.</p>
        </div>
      </div>

      {canManageTeam && (
        <Card padding="md" elevation={1} className="mb-6">
          <h2 className="text-body-s font-semibold text-ink mb-4">Invite Team Member</h2>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-caption font-medium text-ink-secondary mb-1">Email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@school.edu"
                required
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-ink-secondary mb-1">Role</label>
              <Select
                value={inviteRole}
                onChange={setInviteRole}
                options={roleOptions}
                placeholder="Select role..."
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={inviting || !inviteEmail || !inviteRole}
              loading={inviting}
            >
              Send Invite
            </Button>
          </form>
          {inviteError && (
            <p className="mt-3 text-caption text-danger">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-3 text-caption text-success">Invitation sent!</p>
          )}
        </Card>
      )}

      {invitations && invitations.length > 0 && (
        <Card padding="none" elevation={1} className="mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline">
            <h2 className="text-body-s font-semibold text-ink">Pending Invitations</h2>
          </div>
          <div className="grid grid-cols-4 gap-4 px-5 py-2 border-b border-hairline text-caption font-medium text-ink-secondary">
            <span>Email</span>
            <span>Role</span>
            <span>Invited</span>
            <span>Actions</span>
          </div>
          {invitations.map((inv: (typeof invitations)[number]) => (
            <div key={inv._id} className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-hairline last:border-b-0 items-center text-body-s">
              <span className="text-ink">{inv.email}</span>
              <span><RoleBadge role={inv.role} /></span>
              <span className="text-caption text-ink-secondary">{new Date(inv.createdAt).toLocaleDateString()}</span>
              <span>
                {canManageTeam && (
                  <Button variant="ghost" size="sm" onClick={() => revokeInvite({ inviteId: inv._id })}>
                    Revoke
                  </Button>
                )}
              </span>
            </div>
          ))}
        </Card>
      )}

      <Card padding="none" elevation={1} className="overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-hairline text-caption font-medium text-ink-secondary">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Actions</span>
        </div>

        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-body-s text-ink-secondary">
            No team members yet.
          </div>
        ) : (
          members.map((m: (typeof members)[number]) => (
            <div key={m.userId} className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-hairline last:border-b-0 items-center text-body-s">
              <span className="text-ink font-medium">{m.name}</span>
              <span className="text-ink-secondary">{m.email || "N/A"}</span>
              <span>
                <RoleBadge role={m.role} />
              </span>
              <span>
                {canManageTeam && m.userId !== user?.id ? (
                  <Select
                    value={m.role}
                    onChange={(next) => updateRole({ userId: m.userId, role: next })}
                    options={roleOptions}
                  />
                ) : (
                  <span className="text-caption text-ink-tertiary">
                    {m.userId === user?.id ? "You" : "Admin only"}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
