import { Agent } from "@openai/agents";
import type { EnvConfig } from "../config/env.js";
import type { AgentRunContext } from "../types.js";
import { buildProcessInfoAgent } from "./process-info.agent.js";
import { buildTriageAgent } from "./triage.agent.js";

export const ORCHESTRATOR_AGENT_NAME = "orchestrator";

/**
 * Prompt do orquestrador.
 *
 * Objetivo deliberadamente curto: decidir entre os dois especialistas e fazer
 * o handoff. Evitamos que o orquestrador responda diretamente ao cliente — se
 * ele fosse conversacional, perderíamos a personalidade dos especialistas.
 */
const ORCHESTRATOR_INSTRUCTIONS = `Você é um roteador interno de atendimento para um escritório de advocacia.

Seu único trabalho é decidir qual especialista atenderá o cliente e transferir a conversa via handoff:

- Use o especialista "triage" quando o cliente:
  * está fazendo um primeiro contato
  * relata uma situação/fato para análise (demissão, assédio, horas extras, acidente, etc.)
  * pede para avaliar um possível caso
  * faz uma saudação inicial sem contexto claro
  * descreve uma dúvida jurídica genérica sem indicar um processo existente

- Use o especialista "process_info" quando o cliente:
  * pergunta sobre o andamento de um processo que já existe
  * pede atualização de publicação, audiência, sentença, intimação ou recurso
  * quer detalhes operacionais de um processo em curso (ex.: "como está meu processo?", "teve movimentação?")

REGRAS:
- Não responda diretamente ao cliente.
- Não faça perguntas antes do handoff.
- Sempre transfira para um dos dois especialistas disponíveis.
- Se houver dúvida razoável entre os dois, prefira "triage".`;

export interface BuildOrchestratorAgentParams {
  readonly env: EnvConfig;
  readonly context: AgentRunContext;
}

/**
 * Constrói o agente orquestrador com handoffs para `triage` e `process_info`.
 *
 * O orquestrador é instanciado por execução porque o agente `process_info`
 * precisa dos headers contextuais do MCP — e é mais simples recriar a árvore
 * inteira do que mutar agentes em cache.
 */
export function buildOrchestratorAgent(
  params: BuildOrchestratorAgentParams,
): Agent<AgentRunContext> {
  const triageAgent = buildTriageAgent({ env: params.env });
  const processInfoAgent = buildProcessInfoAgent({
    env: params.env,
    context: params.context,
  });

  return new Agent<AgentRunContext>({
    name: ORCHESTRATOR_AGENT_NAME,
    instructions: ORCHESTRATOR_INSTRUCTIONS,
    model: params.env.aiModel,
    handoffs: [triageAgent, processInfoAgent],
    tools: [],
  });
}
