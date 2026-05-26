"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AutomationPanel } from "./automation-panel";
import { DEFAULT_STAGES, DEFAULT_TRANSITIONS } from "@/convex/pipeline_defaults";
import { Button, Card, Dialog, Icon, Input } from "@/components/ui";

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

type PromptKind =
  | { kind: "add" }
  | { kind: "rename"; stageId: string; initial: string }
  | { kind: "remove"; stageId: string };

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
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const stages = localStages ?? pipelineConfig?.stages ?? DEFAULT_STAGES;
  const transitions = localTransitions ?? pipelineConfig?.transitions ?? DEFAULT_TRANSITIONS;

  if (pipelineConfig && localStages === null) {
    setLocalStages(pipelineConfig.stages);
    setLocalTransitions(pipelineConfig.transitions);
  }

  if (pipelineConfig === undefined) {
    return <div className="py-8 text-center text-ink-secondary text-body-s">Loading pipeline configuration...</div>;
  }

  const openAdd = () => {
    setPromptValue("");
    setPrompt({ kind: "add" });
  };

  const openRename = (stage: Stage) => {
    setPromptValue(stage.name);
    setPrompt({ kind: "rename", stageId: stage.id, initial: stage.name });
  };

  const openRemove = (stageId: string) => {
    setPromptValue("");
    setPrompt({ kind: "remove", stageId });
  };

  const closePrompt = () => {
    setPrompt(null);
    setPromptValue("");
  };

  const confirmPrompt = () => {
    if (!prompt) return;
    if (prompt.kind === "add") {
      const name = promptValue.trim();
      if (!name) {
        closePrompt();
        return;
      }
      const newStage: Stage = {
        id: generateId(),
        name,
        order: stages.length,
        isTerminal: false,
      };
      setLocalStages([...stages, newStage]);
    } else if (prompt.kind === "rename") {
      const name = promptValue.trim();
      if (!name) {
        closePrompt();
        return;
      }
      setLocalStages(stages.map((s: Stage) => s.id === prompt.stageId ? { ...s, name } : s));
    } else if (prompt.kind === "remove") {
      setLocalStages(stages.filter((s: Stage) => s.id !== prompt.stageId));
      setLocalTransitions(transitions.filter(
        (t: Transition) => t.fromStageId !== prompt.stageId && t.toStageId !== prompt.stageId,
      ));
    }
    closePrompt();
  };

  const toggleTransition = (fromId: string, toId: string) => {
    const exists = transitions.some(
      (t: Transition) => t.fromStageId === fromId && t.toStageId === toId,
    );
    if (exists) {
      setLocalTransitions(transitions.filter(
        (t: Transition) => !(t.fromStageId === fromId && t.toStageId === toId),
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

  const promptTitle = prompt?.kind === "add"
    ? "Add stage"
    : prompt?.kind === "rename"
    ? "Rename stage"
    : "Delete stage";
  const promptDescription = prompt?.kind === "remove"
    ? "Type the number of candidates currently in this stage to confirm deletion."
    : undefined;
  const promptPlaceholder = prompt?.kind === "remove" ? "Number of candidates" : "Stage name";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-body-s font-semibold text-ink">Pipeline Stages</h2>
          <p className="text-caption text-ink-secondary mt-1">
            Click stages to rename or connect. Click the gear to configure automations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openAdd} iconLeft="Plus">Add Stage</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} loading={saving}>
            Save Pipeline
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages
          .sort((a: Stage, b: Stage) => a.order - b.order)
          .map((stage: Stage) => (
            <div key={stage.id} className="flex-shrink-0 w-44 group">
              <Card padding="sm" elevation={1}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption font-medium uppercase tracking-wider text-ink-tertiary">
                    {stage.isTerminal ? "Final" : `Stage ${stage.order + 1}`}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveStage(stage.id, "up")}
                      className="text-ink-tertiary hover:text-ink"
                      title="Move up"
                      aria-label="Move up"
                    >
                      <Icon name="ChevronUp" size={13} />
                    </button>
                    <button
                      onClick={() => moveStage(stage.id, "down")}
                      className="text-ink-tertiary hover:text-ink"
                      title="Move down"
                      aria-label="Move down"
                    >
                      <Icon name="ChevronDown" size={13} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => openRename(stage)}
                  className="w-full text-left font-semibold text-body-s text-ink hover:text-accent truncate"
                >
                  {stage.name}
                </button>
                <div className="mt-3 space-y-1">
                  {stages
                    .filter((s: Stage) => s.id !== stage.id)
                    .map((targetStage: Stage) => {
                      const connected = transitions.some(
                        (t: Transition) => t.fromStageId === stage.id && t.toStageId === targetStage.id,
                      );
                      return (
                        <div key={targetStage.id} className="flex items-center gap-1">
                          <button
                            onClick={() => toggleTransition(stage.id, targetStage.id)}
                            className={`flex-1 text-left text-caption px-2 py-0.5 rounded-xs transition-colors duration-fast ${
                              connected
                                ? "bg-accent-soft text-accent"
                                : "text-ink-tertiary hover:text-ink"
                            }`}
                          >
                            {connected ? "On " : "Off "}{`→ ${targetStage.name}`}
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
                              className="text-ink-tertiary hover:text-accent px-1"
                              title="Configure automation"
                              aria-label="Configure automation"
                            >
                              <Icon name="Settings" size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
                {!stage.isTerminal && (
                  <button
                    onClick={() => openRemove(stage.id)}
                    className="mt-2 text-caption text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </Card>
            </div>
          ))}
        <button
          onClick={openAdd}
          className="flex-shrink-0 w-44 min-h-[120px] bg-surface-canvas rounded-lg border border-dashed border-hairline-strong flex items-center justify-center text-body-s text-ink-tertiary hover:text-ink hover:border-accent transition-colors duration-fast"
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

      {prompt && (
        <Dialog
          open
          onOpenChange={(next) => { if (!next) closePrompt(); }}
          title={promptTitle}
          description={promptDescription}
          footer={
            <>
              <Button variant="secondary" onClick={closePrompt}>Cancel</Button>
              <Button variant="primary" onClick={confirmPrompt}>Confirm</Button>
            </>
          }
        >
          <Input
            type="text"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder={promptPlaceholder}
            autoFocus
          />
        </Dialog>
      )}
    </div>
  );
}
