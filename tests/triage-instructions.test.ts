import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";
import { describe, expect, it } from "vitest";
import { buildTriageAgent } from "../src/agents/triage.agent.js";
import { buildTriageTrabalhistaAgent } from "../src/agents/triage-trabalhista.agent.js";
import {
  TRIAGE_AGENT_INSTRUCTIONS,
  TRIAGE_AGENT_SIMPLE_INSTRUCTIONS,
  buildTriageAgentInstructions,
} from "../src/agents/instructions/triage.instructions.js";
import { TRIAGE_TRABALHISTA_AGENT_INSTRUCTIONS } from "../src/agents/instructions/triage-trabalhista.instructions.js";
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
  clientId: undefined,
  calendarConnectionId: undefined,
  extra: undefined,
  agenteResponsavelAtendimento: undefined,
};

describe("TRIAGE_AGENT_INSTRUCTIONS — modo especialista (com handoffs)", () => {
  it("posiciona a regra de continuidade no topo, antes das demais regras", () => {
    const continuityIdx = TRIAGE_AGENT_INSTRUCTIONS.indexOf(
      "ENTRADA VIA HANDOFF (CONTINUIDADE)",
    );
    const centralRulesIdx = TRIAGE_AGENT_INSTRUCTIONS.indexOf("REGRAS CENTRAIS");

    expect(continuityIdx).toBeGreaterThan(0);
    expect(centralRulesIdx).toBeGreaterThan(continuityIdx);
  });

  it("lista aberturas proibidas explícitas", () => {
    expect(TRIAGE_AGENT_INSTRUCTIONS).toContain('"Sou a Lia"');
    expect(TRIAGE_AGENT_INSTRUCTIONS).toContain('"Em que posso te ajudar?"');
    expect(TRIAGE_AGENT_INSTRUCTIONS).toContain('"Olá!"');
  });

  it("orquestra handoff para especialista trabalhista e remove checklist detalhista", () => {
    expect(TRIAGE_AGENT_INSTRUCTIONS).toContain("transfer_to_triage_trabalhista");
    expect(TRIAGE_AGENT_INSTRUCTIONS).not.toContain("PERGUNTAS-REFERÊNCIA POR TEMA");
  });
});

describe("TRIAGE_AGENT_SIMPLE_INSTRUCTIONS — modo simples (sem handoffs)", () => {
  it("buildTriageAgentInstructions aponta para a constante correta", () => {
    expect(buildTriageAgentInstructions(false)).toBe(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS);
    expect(buildTriageAgentInstructions(true)).toBe(TRIAGE_AGENT_INSTRUCTIONS);
  });

  it("não inclui bloco de orquestração para especialista nem checklist de handoff", () => {
    expect(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS).not.toContain(
      "REGRA CRÍTICA: ORQUESTRAÇÃO PARA ESPECIALISTA",
    );
    expect(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS).not.toContain(
      "Se havia especialista aplicável, fiz handoff sem texto antes?",
    );
  });

  it("define condução única no agente e proíbe transferência interna", () => {
    expect(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS).toContain("Sua função nesta configuração:");
    expect(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS).toContain("é proibido");
  });
});

describe("buildTriageAgent", () => {
  it("prepara as instruções com RECOMMENDED_PROMPT_PREFIX e mantém o corpo da triagem", () => {
    const agent = buildTriageAgent({ env, context });

    expect(typeof agent.instructions).toBe("string");
    const text = agent.instructions as string;
    expect(text.startsWith(RECOMMENDED_PROMPT_PREFIX)).toBe(true);
    expect(text).toContain("## Contexto temporal (âncora do atendimento)");
    expect(text).toContain(TRIAGE_AGENT_INSTRUCTIONS);
    expect(agent.handoffs.length).toBe(1);
    expect(agent.tools.length).toBe(1);
  });

  it("modo sem handoffs usa TRIAGE_AGENT_SIMPLE_INSTRUCTIONS", () => {
    const agent = buildTriageAgent({
      env,
      context,
      specialistHandoffs: false,
    });
    const text = agent.instructions as string;
    expect(text).toContain(TRIAGE_AGENT_SIMPLE_INSTRUCTIONS);
    expect(text).not.toContain("REGRA CRÍTICA: ORQUESTRAÇÃO PARA ESPECIALISTA");
    expect(agent.handoffs.length).toBe(0);
  });
});

describe("triage trabalhista especialista", () => {
  it("mantém o escopo trabalhista detalhado", () => {
    expect(TRIAGE_TRABALHISTA_AGENT_INSTRUCTIONS).toContain(
      "PERGUNTAS-REFERÊNCIA POR TEMA",
    );
    expect(TRIAGE_TRABALHISTA_AGENT_INSTRUCTIONS).toContain(
      "O escritório atende apenas Direito do Trabalho.",
    );
  });

  it("constrói agente com prefixo recomendado e tool MCP", () => {
    const agent = buildTriageTrabalhistaAgent({ env, context });
    expect(typeof agent.instructions).toBe("string");
    const text = agent.instructions as string;
    expect(text.startsWith(RECOMMENDED_PROMPT_PREFIX)).toBe(true);
    expect(text).toContain(TRIAGE_TRABALHISTA_AGENT_INSTRUCTIONS);
    expect(agent.tools.length).toBe(1);
  });
});
