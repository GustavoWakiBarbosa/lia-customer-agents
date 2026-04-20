import { Agent } from "@openai/agents";
import type { EnvConfig } from "../config/env.js";
import type { AgentRunContext } from "../types.js";
import {
  TRIAGE_AGENT_HANDOFF_DESCRIPTION,
  TRIAGE_AGENT_INSTRUCTIONS,
  TRIAGE_AGENT_NAME,
} from "./instructions/triage.instructions.js";

export interface BuildTriageAgentParams {
  readonly env: EnvConfig;
}

/**
 * Constrói o agente de Triagem (Direito do Trabalho).
 *
 * Esse agente não consome o MCP `legis-mcp`: ele apenas conversa com o cliente
 * para coletar informações. Ferramentas adicionais (ex.: link de agendamento)
 * podem ser injetadas futuramente via `tools: [...]` sem alterar o contrato.
 */
export function buildTriageAgent(
  params: BuildTriageAgentParams,
): Agent<AgentRunContext> {
  return new Agent<AgentRunContext>({
    name: TRIAGE_AGENT_NAME,
    handoffDescription: TRIAGE_AGENT_HANDOFF_DESCRIPTION,
    instructions: TRIAGE_AGENT_INSTRUCTIONS,
    model: params.env.aiModel,
    tools: [],
  });
}
