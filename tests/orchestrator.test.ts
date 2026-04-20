import { describe, expect, it } from "vitest";
import { buildOrchestratorAgent } from "../src/agents/orchestrator.agent.js";
import type { EnvConfig } from "../src/config/env.js";
import type { AgentRunContext } from "../src/types.js";

const env: EnvConfig = {
  aiModel: "gpt-test",
  mcpServerUrl: "https://mcp.example.com",
  mcpServerApiKey: "secret",
};

const context: AgentRunContext = {
  conversationId: "conv-1",
  organizationId: "org-1",
  clientId: "cli-1",
  calendarConnectionId: undefined,
  extra: undefined,
};

describe("buildOrchestratorAgent", () => {
  it("wires up handoffs for triage and process_info", () => {
    const orchestrator = buildOrchestratorAgent({ env, context });

    const handoffNames = orchestrator.handoffs
      .map((entry) => ("agent" in entry ? entry.agent.name : entry.name))
      .sort();

    expect(orchestrator.name).toBe("orchestrator");
    expect(handoffNames).toEqual(["process_info", "triage"]);
  });

  it("propagates the configured model to the orchestrator agent", () => {
    const orchestrator = buildOrchestratorAgent({ env, context });
    expect(orchestrator.model).toBe("gpt-test");
  });
});
