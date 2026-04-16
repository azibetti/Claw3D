import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { installPackagedSkillViaGatewayAgent } from "@/lib/skills/install-gateway";

describe("skills install gateway messaging", () => {
  it("explains that packaged workspace skills cannot be installed into the reserved main workspace", async () => {
    const call = vi.fn(async () => null);

    await expect(
      installPackagedSkillViaGatewayAgent({
        client: { call } as unknown as GatewayClient,
        request: {
          packageId: "task-manager",
          source: "openclaw-workspace",
          workspaceDir: "/home/pi/.openclaw/agents/main/workspace",
          managedSkillsDir: "/home/pi/.openclaw/skills",
          agentId: "main",
          agentName: "main",
        },
      }),
    ).rejects.toThrow(/reserved main agent uses the gateway root workspace/i);
  });
});
