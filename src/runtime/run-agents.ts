import {
  RunHandoffCallItem,
  RunHandoffOutputItem,
  RunMessageOutputItem,
  RunReasoningItem,
  RunToolCallItem,
  RunToolCallOutputItem,
} from "@openai/agents-core";
import { Runner, type AgentInputItem } from "@openai/agents";
import { buildOrchestratorAgent } from "../agents/orchestrator.agent.js";
import { PROCESS_INFO_AGENT_NAME } from "../agents/instructions/process-info.instructions.js";
import { TRIAGE_AGENT_NAME } from "../agents/instructions/triage.instructions.js";
import { loadEnv, type EnvConfig } from "../config/env.js";
import {
  RunInputSchema,
  type AgentId,
  type AgentRunContext,
  type RunInput,
  type RunOutput,
  type RunUsage,
} from "../types.js";

export interface RunAgentsOptions {
  /** Configuração de ambiente. Quando omitida, é carregada via `loadEnv()`. */
  readonly env?: EnvConfig;
}

interface PipelineCounts {
  readonly messageOutputs: number;
  readonly handoffs: number;
  readonly toolCalls: number;
  readonly reasoning: number;
}

interface EmptyAssistantMessage {
  readonly agent: string;
  readonly messageStatus: string | null;
}

/** Log estruturado, uma linha, padrão único de eventos de agentes. */
function logAgentEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "info", event, ...payload }));
}

function logAgentWarn(event: string, payload: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: "warn", event, ...payload }));
}

/**
 * Percorre `newItems` do `RunResult`, emite um warning para cada
 * `output_text` vazio encontrado e devolve contadores agregados da execução.
 */
function summarizeAgentRunPipeline(
  conversationId: string,
  items: ReadonlyArray<unknown>,
): PipelineCounts {
  let messageOutputs = 0;
  let handoffs = 0;
  let toolCalls = 0;
  let reasoning = 0;
  const emptyMessages: EmptyAssistantMessage[] = [];

  for (const item of items) {
    if (item instanceof RunMessageOutputItem) {
      messageOutputs += 1;
      const raw = item.rawItem as {
        status?: string;
        content?: Array<{ type: string; text?: string }>;
      };
      const content = Array.isArray(raw.content) ? raw.content : [];
      const combinedText = content
        .filter((c) => c.type === "output_text")
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .join("");
      if (combinedText.trim().length === 0) {
        emptyMessages.push({
          agent: item.agent.name,
          messageStatus: raw.status ?? null,
        });
      }
      continue;
    }
    if (item instanceof RunHandoffCallItem) {
      continue;
    }
    if (item instanceof RunHandoffOutputItem) {
      handoffs += 1;
      continue;
    }
    if (item instanceof RunToolCallItem) {
      toolCalls += 1;
      continue;
    }
    if (item instanceof RunToolCallOutputItem) {
      continue;
    }
    if (item instanceof RunReasoningItem) {
      reasoning += 1;
      continue;
    }
  }

  for (const empty of emptyMessages) {
    logAgentWarn("agent_empty_message", {
      conversationId,
      agent: empty.agent,
      messageStatus: empty.messageStatus,
    });
  }

  return { messageOutputs, handoffs, toolCalls, reasoning };
}

/**
 * Ponto de entrada da biblioteca. Executa o **orquestrador** (LLM) que decide
 * o handoff para triagem ou consulta processual, com sinais objetivos no
 * contexto (`clientId`, `continuesOpenAiAgentChain`).
 *
 * Responsabilidades desta função:
 *  1. Validar o input via Zod.
 *  2. Montar `AgentRunContext` para uso em ferramentas (MCP, etc).
 *  3. Instanciar o orquestrador com handoffs para triage/process_info.
 *  4. Chamar `run()` do SDK passando `previousResponseId` quando disponível.
 *  5. Normalizar a saída para o contrato `RunOutput`.
 *
 * Erros do SDK são propagados diretamente — quem chama (edge function) decide
 * o tratamento e o que persistir.
 */
export async function runAgents(
  rawInput: RunInput,
  options: RunAgentsOptions = {},
): Promise<RunOutput> {
  const input = RunInputSchema.parse(rawInput);
  const env = options.env ?? loadEnv();

  const context: AgentRunContext = {
    conversationId: input.conversationId,
    organizationId: input.organizationId,
    clientId: input.clientId,
    calendarConnectionId: input.calendarConnectionId,
    extra: input.extra,
    continuesOpenAiAgentChain: Boolean(input.previousResponseId),
  };

  const orchestrator = buildOrchestratorAgent({ env, context });

  // O SDK aceita `string | AgentInputItem[]`. Quando o chamador (rota
  // `generate-ai-response`) já agregou múltiplas mensagens, repassamos como
  // array para preservar a separação semântica de cada mensagem do batch.
  const runInput: string | AgentInputItem[] = input.inputs
    ? (input.inputs as unknown as AgentInputItem[])
    : (input.userMessage as string);

  const runner = new Runner();
  const conversationId = input.conversationId;
  const inputsCount = Array.isArray(input.inputs) ? input.inputs.length : 1;

  console.log("");
  logAgentEvent("agent_run_begin", {
    conversationId,
    startingAgent: orchestrator.name,
    hasClientId: Boolean(input.clientId),
    continuesOpenAiAgentChain: context.continuesOpenAiAgentChain,
    inputsCount,
  });

  runner.on("agent_start", (_runCtx, agent) => {
    logAgentEvent("agent_started", { conversationId, agent: agent.name });
  });

  runner.on("agent_handoff", (_runCtx, fromAgent, toAgent) => {
    logAgentEvent("agent_handoff", {
      conversationId,
      from: fromAgent.name,
      to: toAgent.name,
    });
  });

  runner.on("agent_end", (_runCtx, agent, output) => {
    const isString = typeof output === "string";
    logAgentEvent("agent_ended", {
      conversationId,
      agent: agent.name,
      outputChars: isString ? (output as string).length : -1,
      outputEmpty: isString ? (output as string).trim().length === 0 : false,
    });
  });

  const result = await runner.run(orchestrator, runInput, {
    context,
    ...(input.previousResponseId
      ? { previousResponseId: input.previousResponseId }
      : {}),
  });

  const counts = summarizeAgentRunPipeline(conversationId, result.newItems);
  const output =
    typeof result.finalOutput === "string"
      ? result.finalOutput
      : String(result.finalOutput ?? "");

  logAgentEvent("agent_run_end", {
    conversationId,
    lastAgent: result.lastAgent?.name ?? null,
    finalChars: output.length,
    finalEmpty: output.trim().length === 0,
    steps: counts,
  });
  console.log("");

  return {
    output,
    agentUsed: resolveAgentUsed(result.lastAgent?.name),
    responseId: result.lastResponseId,
    usage: extractUsage(result),
  };
}

/**
 * Resolve o nome do último agente para o enum público `AgentId`.
 *
 * Quando o nome não bate com um agente conhecido, assume-se `triage`.
 */
function resolveAgentUsed(lastAgentName: string | undefined): AgentId {
  if (lastAgentName === PROCESS_INFO_AGENT_NAME) {
    return "process_info";
  }

  if (lastAgentName === TRIAGE_AGENT_NAME) {
    return "triage";
  }

  return "triage";
}

interface RunResultLike {
  runContext?: { usage?: Partial<RunUsage> };
}

function extractUsage(result: RunResultLike): RunUsage {
  const usage = result.runContext?.usage;
  return {
    requests: usage?.requests ?? 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  };
}
