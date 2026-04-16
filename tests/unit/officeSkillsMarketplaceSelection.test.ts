import { describe, expect, it } from "vitest";

type AgentLike = { agentId: string; name: string; sessionKey: string; status: "idle" | "running" | "error"; sessionCreated: boolean; awaitingUserInput: boolean; hasUnseenActivity: boolean; outputLines: string[]; lastResult: string | null; lastDiff: string | null; runId: string | null; runStartedAt: number | null; streamText: string | null; thinkingTrace: string | null; latestOverride: string | null; latestOverrideKind: "heartbeat" | "cron" | null; lastAssistantMessageAt: number | null; lastActivityAt: number | null; latestPreview: string | null; lastUserMessage: string | null; draft: string; sessionSettingsSynced: boolean; historyLoadedAt: number | null; historyFetchLimit: number | null; historyFetchedCount: number | null; historyMaybeTruncated: boolean; toolCallingEnabled: boolean; showThinkingTraces: boolean };

const { resolvePreferredMarketplaceAgentId } = await import("../../src/features/office/hooks/useOfficeSkillsMarketplace");

const makeAgent = (agentId: string): AgentLike => ({
  agentId,
  name: agentId,
  sessionKey: `agent:${agentId}:main`,
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: false,
});

describe("resolvePreferredMarketplaceAgentId", () => {
  it("prefers a non-main agent when no preferred id is provided", () => {
    const result = resolvePreferredMarketplaceAgentId([
      makeAgent("main"),
      makeAgent("writer"),
    ] as never, null);

    expect(result).toBe("writer");
  });

  it("keeps the explicit preferred agent when it exists", () => {
    const result = resolvePreferredMarketplaceAgentId([
      makeAgent("main"),
      makeAgent("writer"),
    ] as never, "main");

    expect(result).toBe("main");
  });
});