"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

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
    return <div className="p-8 text-ink-secondary text-sm">Loading...</div>;
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
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">Roles & Permissions</h1>
        <p className="text-sm text-ink-secondary">Manage roles and what each team member can access.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-apple bg-[#fff2f0] text-sm text-[#ff3b30]">{error}</div>
      )}

      {roles.map((role) => {
        const isEditing = editingId === role._id;
        const isHRAdmin = role.name === "hr_admin";
        const perms = isEditing ? editPermissions : role.permissions;

        return (
          <div key={role._id} className="rounded-apple bg-surface border border-surface-tertiary p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">
                  {ROLE_LABELS[role.name] ?? role.name}
                </span>
                {role.isSystem && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface-secondary text-ink-secondary">system</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(role._id)}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-apple bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-ink-secondary hover:text-ink">
                      Cancel
                    </button>
                  </>
                ) : isHRAdmin ? null : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(role)}
                      className="text-xs text-accent hover:underline"
                    >
                      Edit
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role._id)}
                        className="text-xs text-[#ff3b30] hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isHRAdmin ? (
              <p className="text-xs text-ink-secondary">Full access to everything. Permissions cannot be modified.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ALL_PERMISSIONS.map((p) => {
                  const checked = perms.includes(p.key) || perms.includes("*");
                  return isEditing ? (
                    <label key={p.key} className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setEditPermissions(togglePerm(p.key, editPermissions))}
                        className="w-3.5 h-3.5"
                      />
                      {p.label}
                    </label>
                  ) : (
                    <span
                      key={p.key}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        checked ? "bg-[#e8f0fe] text-accent" : "bg-surface-secondary text-ink-tertiary"
                      }`}
                    >
                      {p.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {showCreate ? (
        <form onSubmit={handleCreate} className="rounded-apple bg-surface border border-surface-tertiary p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Create Role</h3>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Role Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-apple bg-surface-secondary border border-surface-tertiary text-sm"
              placeholder="e.g. Senior Teacher"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermissions.includes(p.key)}
                    onChange={() => setNewPermissions(togglePerm(p.key, newPermissions))}
                    className="w-3.5 h-3.5"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="px-4 py-2 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Role"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewPermissions([]);
              }}
              className="text-xs text-ink-secondary hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed]"
        >
          + Add Role
        </button>
      )}
    </div>
  );
}
