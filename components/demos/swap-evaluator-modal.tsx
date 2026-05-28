"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, Badge, Button, Dialog, Input, useToast } from "@/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  inviteId: string;
  schoolId: string;
  evaluatorRole: string;
  excludeUserId: string;
  onSwapped: () => void;
}

export function SwapEvaluatorModal({
  open, onClose, inviteId, schoolId, evaluatorRole, excludeUserId, onSwapped,
}: Props) {
  const staff = useQuery(api.users.listSchoolStaff, {
    schoolId: schoolId as Id<"schools">,
  });
  const swap = useMutation(api.evaluationInvites.swap);
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const term = q.trim().toLowerCase();
    return staff
      .filter((u) => u._id !== excludeUserId)
      .filter((u) => !term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
  }, [staff, excludeUserId, q]);

  const pick = async (userId: string) => {
    setBusy(true);
    try {
      await swap({
        inviteId: inviteId as Id<"evaluationInvites">,
        newEvaluatorUserId: userId as Id<"userProfiles">,
      });
      toast({ message: "Evaluator swapped", variant: "success" });
      onSwapped();
      onClose();
    } catch (e: any) {
      toast({ message: e.message ?? "Swap failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Swap evaluator"
      description={`Pick a replacement for this ${evaluatorRole} invite. The old invite is cancelled and a new invite is issued to the chosen evaluator.`}
    >
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-body-s text-ink-tertiary py-2">No matching staff.</p>
          ) : filtered.map((u) => (
            <button
              key={u._id}
              type="button"
              disabled={busy}
              onClick={() => pick(u._id)}
              className="w-full flex items-center gap-3 rounded-apple px-2.5 py-2 hover:bg-accent-soft transition-colors text-left disabled:opacity-50"
            >
              <Avatar name={u.name ?? "?"} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-body-s text-ink truncate">{u.name ?? "Unnamed"}</p>
                <p className="text-caption text-ink-tertiary truncate">{u.email}</p>
              </div>
              <Badge variant="neutral">{u.role}</Badge>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
