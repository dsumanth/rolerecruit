"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AutomationPanel } from "./automation-panel";
import { DEFAULT_STAGES, DEFAULT_TRANSITIONS } from "@/convex/pipeline_defaults";

interface Stage {
  id: string;
  name: string;
  order: number;
  isTerminal?: boolean;
  color?: string;
}

interface Transition {
  fromStageId: string;
  toStageId: string;
}

interface Props {
  schoolId: Id<"schools">;
}

function generateId(): string {
  return `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function PipelineStageEditor({ schoolId }: Props) {
  const pipelineConfig = useQuery(api.pipeline_config.getForSchool, { schoolId });
  const updatePipeline = useMutation(api.pipeline_config.updatePipeline);
  const [localStages, setLocalStages] = useState<Stage[] | null>(null);
  const [localTransitions, setLocalTransitions] = useState<Transition[] | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<{
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const stages = localStages ?? pipelineConfig?.stages ?? DEFAULT_STAGES;
  const transitions = localTransitions ?? pipelineConfig?.transitions ?? DEFAULT_TRANSITIONS;

  if (pipelineConfig && localStages === null) {
    setLocalStages(pipelineConfig.stages);
    setLocalTransitions(pipelineConfig.transitions);
  }

  if (pipelineConfig === undefined) return <div className="py-8 text-center text-ink-secondary text-sm">Loading pipeline configuration...</div>;

  const addStage = () => {
    const name = window.prompt("Stage name:");
    if (!name?.trim()) return;
    const newStage: Stage = {
      id: generateId(),
      name: name.trim(),
      order: stages.length,
      isTerminal: false,
    };
    setLocalStages([...stages, newStage]);
  };

  const removeStage = (stageId: string) => {
    const count = window.prompt(
      "Type the number of candidates currently in this stage to confirm deletion."
    );
    if (count === null) return;
    setLocalStages(stages.filter((s: Stage) => s.id !== stageId));
    setLocalTransitions(transitions.filter(
      (t: Transition) => t.fromStageId !== stageId && t.toStageId !== stageId
    ));
  };

  const renameStage = (stageId: string) => {
    const name = window.prompt("New stage name:");
    if (!name?.trim()) return;
    setLocalStages(stages.map((s: Stage) => s.id === stageId ? { ...s, name: name.trim() } : s));
  };

  const toggleTransition = (fromId: string, toId: string) => {
    const exists = transitions.some(
      (t: Transition) => t.fromStageId === fromId && t.toStageId === toId
    );
    if (exists) {
      setLocalTransitions(transitions.filter(
        (t: Transition) => !(t.fromStageId === fromId && t.toStageId === toId)
      ));
    } else {
      setLocalTransitions([...transitions, { fromStageId: fromId, toStageId: toId }]);
    }
  };

  const moveStage = (stageId: string, direction: "up" | "down") => {
    const index = stages.findIndex((s: Stage) => s.id === stageId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === stages.length - 1) return;
    const newStages = [...stages];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newStages[index], newStages[swapIndex]] = [newStages[swapIndex], newStages[index]];
    newStages.forEach((s: Stage, i: number) => { s.order = i; });
    setLocalStages(newStages);
  };

  const handleSave = async () => {
    if (stages.length < 2) {
      alert("Pipeline must have at least 2 stages.");
      return;
    }
    setSaving(true);
    try {
      await updatePipeline({ schoolId, stages, transitions });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Pipeline Stages</h2>
          <p className="text-xs text-ink-secondary mt-1">
            Click stages to rename or connect. Click ⚙ to configure automations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addStage}
            className="px-4 py-2 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary transition-colors"
          >
            + Add Stage
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Pipeline"}
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages
          .sort((a, b) => a.order - b.order)
          .map((stage) => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-44 bg-surface rounded-apple border border-surface-tertiary shadow-elevation-low p-4 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-tertiary">
                  {stage.isTerminal ? "Final" : `Stage ${stage.order + 1}`}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveStage(stage.id, "up")}
                    className="text-ink-tertiary hover:text-ink text-xs"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStage(stage.id, "down")}
                    className="text-ink-tertiary hover:text-ink text-xs"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <button
                onClick={() => renameStage(stage.id)}
                className="w-full text-left font-semibold text-sm text-ink hover:text-accent truncate"
              >
                {stage.name}
              </button>
              <div className="mt-3 space-y-1">
                {stages
                  .filter(s => s.id !== stage.id)
                  .map(targetStage => {
                    const connected = transitions.some(
                      t => t.fromStageId === stage.id && t.toStageId === targetStage.id
                    );
                    return (
                      <div key={targetStage.id} className="flex items-center gap-1">
                        <button
                          onClick={() => toggleTransition(stage.id, targetStage.id)}
                          className={`flex-1 text-left text-xs px-2 py-0.5 rounded transition-colors ${
                            connected
                              ? "bg-accent/10 text-accent"
                              : "text-ink-tertiary hover:text-ink"
                          }`}
                        >
                          {connected ? "✓ " : "○ "}→ {targetStage.name}
                        </button>
                        {connected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransition({
                                fromId: stage.id,
                                fromName: stage.name,
                                toId: targetStage.id,
                                toName: targetStage.name,
                              });
                            }}
                            className="text-ink-tertiary hover:text-accent text-xs px-1"
                            title="Configure automation"
                          >
                            ⚙
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
              {!stage.isTerminal && (
                <button
                  onClick={() => removeStage(stage.id)}
                  className="mt-2 text-xs text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        <button
          onClick={addStage}
          className="flex-shrink-0 w-44 min-h-[120px] bg-surface-secondary rounded-apple border-2 border-dashed border-surface-tertiary flex items-center justify-center text-sm text-ink-tertiary hover:text-ink transition-colors"
        >
          + Add Stage
        </button>
      </div>

      {selectedTransition && (
        <AutomationPanel
          schoolId={schoolId}
          fromStageId={selectedTransition.fromId}
          fromStageName={selectedTransition.fromName}
          toStageId={selectedTransition.toId}
          toStageName={selectedTransition.toName}
          onClose={() => setSelectedTransition(null)}
        />
      )}
    </div>
  );
}
