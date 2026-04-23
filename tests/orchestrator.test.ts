import { Handoff } from "@openai/agents-core";
import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";
import { describe, expect, it } from "vitest";
import { cleanHandoffHistory } from "../src/agents/handoff-filters.js";
import {
  buildOrchestratorAgent,
  buildOrchestratorInstructions,
} from "../src/agents/orchestrator.agent.js";
import type { EnvConfig } from "../src/config/env.js";
import type { AgentRunContext } from "../src/types.js";

const env: EnvConfig = {
  aiModel: "gpt-test",
  mcpServerUrl: "https://mcp.example.com",
  mcpServerApiKey: "secret",
};

const context: AgentRunContext = {
  conversaId: "conv-1",
  organizationId: "org-1",
  clientId: "cli-1",
  calendarConnectionId: undefined,
  extra: undefined,
  continuesOpenAiAgentChain: false,
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

  it("envolve cada handoff em `Handoff` com `cleanHandoffHistory` como inputFilter", () => {
    const orchestrator = buildOrchestratorAgent({ env, context });

    expect(orchestrator.handoffs.length).toBe(2);
    for (const entry of orchestrator.handoffs) {
      expect(entry).toBeInstanceOf(Handoff);
      const ho = entry as Handoff;
      expect(ho.inputFilter).toBe(cleanHandoffHistory);
    }
  });

  it("propagates the configured model to the orchestrator agent", () => {
    const orchestrator = buildOrchestratorAgent({ env, context });
    expect(orchestrator.model).toBe("gpt-test");
  });
});

describe("buildOrchestratorInstructions", () => {
  it("injeta sinais de clientId e encadeamento OpenAI no texto", () => {
    const noClientNoChain = buildOrchestratorInstructions({
      conversaId: "c1",
      organizationId: "o1",
      clientId: undefined,
      calendarConnectionId: undefined,
      extra: undefined,
      continuesOpenAiAgentChain: false,
    });
    expect(noClientNoChain).toContain("clientId / pessoa identificada): não");
    expect(noClientNoChain).toContain("Encadeamento desta execução");
    expect(noClientNoChain).toMatch(/OpenAI[^\n]+: não/);

    const linkedWithChain = buildOrchestratorInstructions({
      conversaId: "c1",
      organizationId: "o1",
      clientId: "p1",
      calendarConnectionId: undefined,
      extra: undefined,
      continuesOpenAiAgentChain: true,
    });
    expect(linkedWithChain).toContain("clientId / pessoa identificada): sim");
    expect(linkedWithChain).toMatch(/OpenAI[^\n]+: sim/);
  });

  it("começa com o RECOMMENDED_PROMPT_PREFIX da SDK", () => {
    const result = buildOrchestratorInstructions({
      conversaId: "c1",
      organizationId: "o1",
      clientId: undefined,
      calendarConnectionId: undefined,
      extra: undefined,
      continuesOpenAiAgentChain: false,
    });
    expect(result.startsWith(RECOMMENDED_PROMPT_PREFIX)).toBe(true);
  });

  it("deixa explícito que consulta de processo por CPF é handoff para process_info, não promessa na recepção", () => {
    const result = buildOrchestratorInstructions({
      conversaId: "c1",
      organizationId: "o1",
      clientId: "p1",
      calendarConnectionId: undefined,
      extra: undefined,
      continuesOpenAiAgentChain: false,
    });
    expect(result).toContain("getLatelyProcess");
    expect(result).toContain("transfer_to_process_info");
    expect(result).toContain("tribunal, vara, cidade");
  });
});
