"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";

import {
  listSharedTaskRecords,
  TaskStoreRequestError,
  upsertSharedTaskRecord,
} from "@/lib/tasks/shared-store-client";

type OperationsTask = Awaited<ReturnType<typeof listSharedTaskRecords>>[number];

type OperationsColumn = {
  id: string;
  label: string;
  agentId: string | null;
};

const DEFAULT_OPERATIONAL_COLUMNS: OperationsColumn[] = [
  { id: "backlog", label: "Backlog", agentId: null },
  { id: "gestor", label: "Gestor", agentId: "gestor" },
  { id: "copywriter", label: "Copywriter", agentId: "copywriter" },
  { id: "designer", label: "Designer", agentId: "designer" },
  { id: "revisor", label: "Revisor", agentId: "revisor" },
];

const STATUS_LABELS: Record<OperationsTask["status"], string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

const STATUS_TONE: Record<OperationsTask["status"], string> = {
  todo: "border-white/10 text-white/55",
  in_progress: "border-cyan-400/30 text-cyan-100",
  blocked: "border-rose-400/30 text-rose-100",
  review: "border-amber-400/30 text-amber-100",
  done: "border-emerald-400/30 text-emerald-100",
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "No activity";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "No activity";
  const delta = Math.max(0, Date.now() - parsed);
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
  if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))}h ago`;
  return `${Math.max(1, Math.floor(delta / 86_400_000))}d ago`;
};

const formatAgentLabel = (agentId: string) =>
  agentId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const sortTasks = (tasks: OperationsTask[]) =>
  [...tasks].sort((left, right) => {
    const leftAt = Date.parse(left.lastActivityAt ?? left.updatedAt);
    const rightAt = Date.parse(right.lastActivityAt ?? right.updatedAt);
    return rightAt - leftAt;
  });

const buildColumns = (tasks: OperationsTask[]): OperationsColumn[] => {
  const known = new Set(DEFAULT_OPERATIONAL_COLUMNS.map((column) => column.agentId ?? "backlog"));
  const extras = Array.from(
    new Set(
      tasks
        .map((task) => task.assignedAgentId?.trim() ?? "")
        .filter((agentId) => agentId.length > 0 && !known.has(agentId)),
    ),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((agentId) => ({
      id: `agent:${agentId}`,
      label: formatAgentLabel(agentId),
      agentId,
    }));
  return [...DEFAULT_OPERATIONAL_COLUMNS, ...extras];
};

export default function OperationsBoardPage() {
  const [tasks, setTasks] = useState<OperationsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    setRefreshing(true);
    try {
      const records = await listSharedTaskRecords();
      setTasks(sortTasks(records.filter((task) => !task.isArchived)));
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof TaskStoreRequestError
          ? fetchError.message
          : "Failed to load the operations board.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const columns = useMemo(() => buildColumns(tasks), [tasks]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const moveTask = useCallback(
    async (taskId: string, agentId: string | null) => {
      const existing = tasks.find((task) => task.id === taskId);
      if (!existing) return;
      const optimistic = {
        ...existing,
        assignedAgentId: agentId,
        updatedAt: new Date().toISOString(),
      };
      setSavingTaskId(taskId);
      setTasks((current) =>
        sortTasks(current.map((task) => (task.id === taskId ? optimistic : task))),
      );
      try {
        const saved = await upsertSharedTaskRecord({
          ...existing,
          assignedAgentId: agentId,
          updatedAt: optimistic.updatedAt,
        });
        setTasks((current) =>
          sortTasks(current.map((task) => (task.id === taskId ? saved : task))),
        );
        setError(null);
      } catch (saveError) {
        setTasks((current) =>
          sortTasks(current.map((task) => (task.id === taskId ? existing : task))),
        );
        setError(
          saveError instanceof TaskStoreRequestError
            ? saveError.message
            : "Failed to update task assignment.",
        );
      } finally {
        setSavingTaskId(null);
      }
    },
    [tasks],
  );

  const createTask = useCallback(async () => {
    const now = new Date().toISOString();
    setSavingTaskId("__new__");
    try {
      const created = await upsertSharedTaskRecord({
        id: globalThis.crypto.randomUUID(),
        title: "New backlog task",
        description: "Describe the work to be routed through the operational queue.",
        status: "todo",
        source: "claw3d_manual",
        assignedAgentId: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      });
      setTasks((current) => sortTasks([created, ...current]));
      setSelectedTaskId(created.id);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof TaskStoreRequestError
          ? saveError.message
          : "Failed to create a new task.",
      );
    } finally {
      setSavingTaskId(null);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#11243a,transparent_38%),linear-gradient(180deg,#050816_0%,#07111d_48%,#05070d_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 pb-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200/75">
              Operations Board
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-white/95">
              Agent queues on top of the shared task store
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              This is the separate operational visualization. The original Kanban remains inside the main office sidebar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/office"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition-colors hover:border-white/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Office
            </Link>
            <button
              type="button"
              onClick={() => void refreshTasks()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition-colors hover:border-white/20 hover:text-white"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void createTask()}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-300/45 hover:text-white"
              disabled={savingTaskId === "__new__"}
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className={`mt-6 grid min-h-0 flex-1 gap-4 ${selectedTask ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
          <div className="min-h-0 overflow-x-auto pb-4">
            <div className="grid min-w-[1100px] grid-cols-5 gap-4 xl:min-w-[1280px]">
              {columns.map((column) => {
                const columnTasks = tasks.filter(
                  (task) => (task.assignedAgentId ?? null) === column.agentId,
                );
                return (
                  <section
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event: DragEvent<HTMLElement>) => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("text/operations-task-id").trim();
                      if (!taskId) return;
                      void moveTask(taskId, column.agentId);
                    }}
                    className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-black/20 backdrop-blur"
                  >
                    <div className="border-b border-white/8 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
                            Queue
                          </div>
                          <div className="mt-1 text-sm font-medium text-white/90">{column.label}</div>
                        </div>
                        <div className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-white/55">
                          {columnTasks.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-3">
                      {loading ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/35">
                          Loading tasks...
                        </div>
                      ) : columnTasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/35">
                          Drop a card here.
                        </div>
                      ) : (
                        columnTasks.map((task) => {
                          const isSelected = selectedTaskId === task.id;
                          return (
                            <button
                              key={task.id}
                              type="button"
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData("text/operations-task-id", task.id);
                                event.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
                              className={`flex w-full flex-col rounded-xl border px-3 py-3 text-left transition-colors ${
                                isSelected
                                  ? "border-cyan-400/35 bg-cyan-500/[0.10]"
                                  : "border-white/8 bg-white/[0.03] hover:border-cyan-400/20 hover:bg-cyan-500/[0.04]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="line-clamp-2 text-sm font-medium text-white/92">{task.title}</div>
                                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_TONE[task.status]}`}>
                                  {STATUS_LABELS[task.status]}
                                </span>
                              </div>
                              {task.description ? (
                                <div className="mt-2 line-clamp-3 text-xs leading-5 text-white/58">
                                  {task.description}
                                </div>
                              ) : null}
                              <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                                <span>{task.source.replaceAll("_", " ")}</span>
                                <span>{savingTaskId === task.id ? "Saving..." : formatRelativeTime(task.lastActivityAt ?? task.updatedAt)}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {selectedTask ? (
            <aside className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-200/70">
                Task details
              </div>
              <h2 className="mt-3 text-lg font-semibold text-white/95">{selectedTask.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_TONE[selectedTask.status]}`}>
                  {STATUS_LABELS[selectedTask.status]}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
                  {(selectedTask.assignedAgentId && formatAgentLabel(selectedTask.assignedAgentId)) || "Backlog"}
                </span>
              </div>
              <div className="mt-4 space-y-4 text-sm text-white/70">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Description
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-white/75">
                    {selectedTask.description || "No description yet."}
                  </p>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Notes
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-white/75">
                    {selectedTask.notes.length > 0 ? selectedTask.notes.join("\n") : "No notes yet."}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Metadata
                  </div>
                  <div className="mt-1 grid gap-1 text-white/60">
                    <div>Task ID: {selectedTask.id}</div>
                    <div>Updated: {formatRelativeTime(selectedTask.lastActivityAt ?? selectedTask.updatedAt)}</div>
                    <div>Source: {selectedTask.source.replaceAll("_", " ")}</div>
                    <div>Run ID: {selectedTask.runId ?? "-"}</div>
                  </div>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}