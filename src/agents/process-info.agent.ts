import { Agent } from "@openai/agents";
import type { EnvConfig } from "../config/env.js";
import { buildLegisMcpTool } from "../mcp/legis-mcp.js";
import type { AgentRunContext } from "../types.js";
import {
  PROCESS_INFO_AGENT_HANDOFF_DESCRIPTION,
  PROCESS_INFO_AGENT_INSTRUCTIONS,
  PROCESS_INFO_AGENT_NAME,
} from "./instructions/process-info.instructions.js";

export interface BuildProcessInfoAgentParams {
  readonly env: EnvConfig;
  readonly context: AgentRunContext;
}

/**
 * Constrói o agente de Consulta de Informações Processuais.
 *
 * Este agente é o principal consumidor do MCP `legis-mcp`. A tool do MCP é
 * instanciada a cada run porque os headers dependem do contexto da requisição
 * (conversa, organização, cliente, calendário).
 */
export function buildProcessInfoAgent(
  params: BuildProcessInfoAgentParams,
): Agent<AgentRunContext> {
  const legisMcp = buildLegisMcpTool({
    env: params.env,
    context: params.context,
  });

  return new Agent<AgentRunContext>({
    name: PROCESS_INFO_AGENT_NAME,
    handoffDescription: PROCESS_INFO_AGENT_HANDOFF_DESCRIPTION,
    instructions: PROCESS_INFO_AGENT_INSTRUCTIONS,
    model: params.env.aiModel,
    tools: [legisMcp],
  });
}
