"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Button, Card, Input } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR Admin",
  principal: "Principal",
  hod: "HOD",
  viewer: "Viewer",
};

const ALL_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "pipeline", label: "Pipeline" },
  { key: "feedback", label: "Feedback" },
  { key: "talent", label: "Talent Bank" },
  { key: "team", label: "Team (view)" },
  { key: "team:manage", label: "Team (manage)" },
  { key: "settings", label: "Settings (view)" },
  { key: "settings:manage", label: "Settings (manage)" },
];

export default function RolesPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const roles = useQuery(api.roles.list, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const updateRole = useMutation(api.roles.update);
  const createRole = useMutation(api.roles.create);
  const removeRole = useMutation(api.roles.remove);
  const seedDefaults = useMutation(api.roles.seedDefaults);
  const [seeded, setSeeded] = useState(false);

  const [editingId, setEditingId] = useState<Id<"roles"> | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (roles && roles.length === 0 && !seeded && profile?.schoolId) {
      setSeeded(true);
      seedDefaults({ schoolId: profile.schoolId });
    }
  }, [roles, seeded, profile?.schoolId, seedDefaults]);

  if (!profile || !roles) {
    return <div className="p-8 text-ink-secondary text-body-s">Loading...</div>;
  }

  const togglePerm = (key: string, current: string[]) => {
    if (current.includes(key)) {
      return current.filter((p) => p !== key);
    }
    return [...current, key];
  };

  const startEdit = (role: (typeof roles)[0]) => {
    if (role.name === "hr_admin") return;
    setEditingId(role._id);
    setEditPermissions([...role.permissions]);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPermissions([]);
    setError("");
  };

  const saveEdit = async (roleId: Id<"roles">) => {
    setSaving(true);
    setError("");
    try {
      await updateRole({ roleId, permissions: editPermissions });
      setEditingId(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.schoolId || !newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createRole({
        schoolId: profile.schoolId,
        name: newName.trim(),
        permissions: newPermissions,
      });
      setShowCreate(false);
      setNewName("");
      setNewPermissions([]);
    } catch (e: any) {
      setError(e.message ?? "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId: Id<"roles">) => {
    if (!confirm("Delete this role?")) return;
    setError("");
    try {
      await removeRole({ roleId });
    } catch (e: any) {
      setError(e.message ?? "Failed to delete role");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-title-l text-ink mb-1">Roles & Permissions</h1>
        <p className="text-body-s text-ink-secondary">Manage roles and what each team member can access.</p>
      </div>

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {error}
        </div>
      )}

      {roles.map((role) => {
        const isEditing = editingId === role._id;
        const isHRAdmin = role.name === "hr_admin";
        const perms = isEditing ? editPermissions : role.permissions;

        return (
          <Card key={role._id} padding="md" elevation={1}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-body-s font-semibold text-ink">
                  {ROLE_LABELS[role.name] ?? role.name}
                </span>
                {role.isSystem && (
                  <Badge variant="neutral">system</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button variant="primary" size="sm" onClick={() => saveEdit(role._id)} disabled={saving} loading={saving}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : isHRAdmin ? null : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(role)}>
                      Edit
                    </Button>
                    {!role.isSystem && (
                      <Button variant="danger" size="sm" onClick={() => handleDelete(role._id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isHRAdmin ? (
              <p className="text-caption text-ink-secondary">Full access to everything. Permissions cannot be modified.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ALL_PERMISSIONS.map((p) => {
                  const checked = perms.includes(p.key) || perms.includes("*");
                  return isEditing ? (
                    <label key={p.key} className="flex items-center gap-1.5 text-caption text-ink-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEditPermissions(togglePerm(p.key, editPermissions))}
                        className="w-3.5 h-3.5 accent-[var(--accent)]"
                      />
                      {p.label}
                    </label>
                  ) : checked ? (
                    <Badge key={p.key} variant="info">{p.label}</Badge>
                  ) : (
                    <Badge key={p.key} variant="neutral">{p.label}</Badge>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {showCreate ? (
        <Card padding="md" elevation={1}>
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-body-s font-semibold text-ink">Create Role</h3>
            <div>
              <label className="block text-caption font-medium text-ink-secondary mb-1">Role Name</label>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Senior Teacher"
                required
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-ink-secondary mb-2">Permissions</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-caption text-ink-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.includes(p.key)}
                      onChange={() => setNewPermissions(togglePerm(p.key, newPermissions))}
                      className="w-3.5 h-3.5 accent-[var(--accent)]"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !newName.trim()}
                loading={saving}
              >
                Create Role
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setNewPermissions([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button variant="primary" iconLeft="Plus" onClick={() => setShowCreate(true)}>
          Add Role
        </Button>
      )}
    </div>
  );
}
