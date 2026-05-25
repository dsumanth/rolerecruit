"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge, Button, Card } from "@/components/ui";
import { Input } from "@/components/ui/input";

interface Pool {
  _id: string;
  name: string;
  createdBy: string;
  tags: string[];
  candidateCount: number;
}

interface PoolSelectorProps {
  schoolId: string | undefined;
  pools: Pool[];
}

export function PoolSelector({ schoolId, pools }: PoolSelectorProps) {
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; tags: string[] }>>([]);

  const createPool = useMutation(api.pools.create);
  const updatePool = useMutation(api.pools.update);
  const removePool = useMutation(api.pools.remove);
  const suggestPools = useAction(api.pools.suggest);

  const handleCreate = async () => {
    if (!newName.trim() || !schoolId) return;
    await createPool({
      schoolId: schoolId as any,
      name: newName.trim(),
      tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
      createdBy: "admin",
    } as any);
    setNewName("");
    setNewTags("");
  };

  const handleUpdate = async (poolId: string) => {
    if (!editName.trim()) return;
    await updatePool({
      poolId: poolId as any,
      name: editName.trim(),
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setEditingId(null);
  };

  const handleDelete = async (poolId: string) => {
    await removePool({ poolId: poolId as any });
  };

  const handleSuggest = async () => {
    if (!schoolId) return;
    setSuggesting(true);
    try {
      const result = await suggestPools({ schoolId: schoolId as any });
      setSuggestions(result);
    } catch {
      // ignore
    } finally {
      setSuggesting(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: { name: string; tags: string[] }) => {
    if (!schoolId) return;
    await createPool({
      schoolId: schoolId as any,
      name: suggestion.name,
      tags: suggestion.tags,
      createdBy: "ai",
    });
    setSuggestions(suggestions.filter((s) => s.name !== suggestion.name));
  };

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-s font-semibold text-ink">Manage Pools</h3>
        <Button variant="secondary" size="sm" onClick={handleSuggest} loading={suggesting}>
          Suggest Pools
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption text-ink-secondary">AI Suggestions</p>
          {suggestions.map((s) => (
            <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-sm bg-surface-canvas">
              <div>
                <span className="text-body-s text-ink">{s.name}</span>
                <span className="text-caption text-ink-secondary ml-2">
                  {s.tags.join(", ")}
                </span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="primary" onClick={() => handleAcceptSuggestion(s)}>
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSuggestions(suggestions.filter((x) => x.name !== s.name))}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pools.length > 0 && (
        <div className="space-y-1">
          {pools.map((pool) => (
            <div
              key={pool._id}
              className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-surface-canvas transition-colors"
            >
              {editingId === pool._id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Pool name"
                    className="text-body-s h-8 flex-1"
                  />
                  <Input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="Tags (comma-separated)"
                    className="text-body-s h-8 flex-1"
                  />
                  <Button size="sm" onClick={() => handleUpdate(pool._id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-body-s text-ink">{pool.name}</span>
                    <Badge variant={pool.createdBy === "ai" ? "info" : "neutral"}>
                      {pool.createdBy === "ai" ? "AI" : "Admin"}
                    </Badge>
                    <span className="text-caption text-ink-tertiary">
                      {pool.candidateCount} candidate{pool.candidateCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(pool._id);
                        setEditName(pool.name);
                        setEditTags(pool.tags.join(", "));
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(pool._id)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New pool name (e.g., TGT English)"
          className="text-body-s flex-1"
        />
        <Input
          value={newTags}
          onChange={(e) => setNewTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="text-body-s flex-1"
        />
        <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !schoolId}>
          Create Pool
        </Button>
      </div>

      {pools.length === 0 && suggestions.length === 0 && (
        <p className="text-caption text-ink-secondary text-center py-4">
          No pools yet. Create one or let AI suggest some based on your candidates.
        </p>
      )}
    </Card>
  );
}
