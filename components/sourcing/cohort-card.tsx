"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CohortCardProps {
  displayName: string;
  memberCount: number;
  onView: () => void;
}

export function CohortCard({ displayName, memberCount, onView }: CohortCardProps) {
  return (
    <Card padding="none" className="p-4 flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <div className="text-ink font-medium">{displayName}</div>
        <div className="text-ink-muted text-sm flex items-center gap-2">
          <Badge variant="info" dot>
            {memberCount} candidate{memberCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
      <Button variant="secondary" onClick={onView}>
        View
      </Button>
    </Card>
  );
}
