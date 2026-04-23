/**
 * Persistência opcional do resultado bruto de `runner.run` (OpenAI Agents SDK).
 *
 * Variáveis de ambiente:
 * - `AGENT_RUN_RAW_LOG_PATH` — arquivo NDJSON (uma linha JSON por run). Padrão: `logs/agent-runs.ndjson`.
 * - `AGENT_RUN_RAW_LOG_DISABLE` — se `1`, não grava arquivo.
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type Host = { process?: { env?: Record<string, string | undefined> } };

function readEnv(name: string): string | undefined {
  const v = (globalThis as Host).process?.env?.[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function resolveAgentRunRawLogPath(): string | undefined {
  if (readEnv("AGENT_RUN_RAW_LOG_DISABLE") === "1") {
    return undefined;
  }
  return readEnv("AGENT_RUN_RAW_LOG_PATH") ?? "logs/agent-runs.ndjson";
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

/** Forma mínima do `RunResult` do SDK usada só para serialização. */
type RunResultLike = {
  readonly input?: unknown;
  readonly newItems?: unknown[];
  readonly output?: unknown;
  readonly history?: unknown;
  readonly finalOutput?: unknown;
  readonly lastResponseId?: string;
  readonly lastAgent?: { readonly name?: string };
  readonly rawResponses?: unknown[];
  readonly inputGuardrailResults?: unknown;
  readonly outputGuardrailResults?: unknown;
  readonly toolInputGuardrailResults?: unknown;
  readonly toolOutputGuardrailResults?: unknown;
  readonly interruptions?: unknown;
  readonly runContext?: { toJSON?: () => unknown };
  readonly state?: { toJSON?: (opts?: { includeTracingApiKey?: boolean }) => unknown };
  readonly agentToolInvocation?: unknown;
};

/**
 * Monta um objeto JSON-safe com o máximo de fidelidade ao `RunResult` do SDK.
 */
export function buildAgentRunRawLogRecord(params: {
  readonly conversaId: string;
  readonly organizationId: string;
  readonly clientId: string | undefined;
  readonly openaiConversationId: string | undefined;
  readonly model: string;
  readonly result: unknown;
}): Record<string, unknown> {
  const result = params.result as RunResultLike;

  const newItems = Array.isArray(result.newItems)
    ? result.newItems.map(serializeRunItem)
    : [];

  let stateJson: unknown = undefined;
  try {
    if (result.state && typeof result.state.toJSON === "function") {
      stateJson = result.state.toJSON();
    }
  } catch {
    stateJson = { error: "state.toJSON_failed" };
  }

  let runContextJson: unknown = undefined;
  try {
    if (result.runContext && typeof result.runContext.toJSON === "function") {
      runContextJson = result.runContext.toJSON();
    }
  } catch {
    runContextJson = { error: "runContext.toJSON_failed" };
  }

  let rawResponses: unknown = undefined;
  try {
    if (Array.isArray(result.rawResponses)) {
      rawResponses = JSON.parse(
        JSON.stringify(result.rawResponses, jsonReplacer),
      );
    }
  } catch {
    rawResponses = { error: "rawResponses_not_serializable" };
  }

  const guard = (value: unknown, name: string): unknown => {
    try {
      return JSON.parse(JSON.stringify(value, jsonReplacer));
    } catch {
      return { error: `${name}_not_serializable` };
    }
  };

  return {
    version: 1,
    at: new Date().toISOString(),
    conversaId: params.conversaId,
    organizationId: params.organizationId,
    clientId: params.clientId ?? null,
    openaiConversationId: params.openaiConversationId ?? null,
    model: params.model,
    runResult: {
      input: result.input,
      newItems,
      output: guard(result.output, "output"),
      history: guard(result.history, "history"),
      finalOutput: result.finalOutput,
      lastResponseId: result.lastResponseId,
      lastAgentName: result.lastAgent?.name ?? null,
      rawResponses,
      inputGuardrailResults: guard(
        result.inputGuardrailResults,
        "inputGuardrailResults",
      ),
      outputGuardrailResults: guard(
        result.outputGuardrailResults,
        "outputGuardrailResults",
      ),
      toolInputGuardrailResults: guard(
        result.toolInputGuardrailResults,
        "toolInputGuardrailResults",
      ),
      toolOutputGuardrailResults: guard(
        result.toolOutputGuardrailResults,
        "toolOutputGuardrailResults",
      ),
      interruptions: guard(result.interruptions, "interruptions"),
      runContext: runContextJson,
      state: stateJson,
      agentToolInvocation: guard(
        result.agentToolInvocation,
        "agentToolInvocation",
      ),
    },
  };
}

function serializeRunItem(item: unknown): unknown {
  if (item === null || typeof item !== "object") {
    return item;
  }
  const o = item as Record<string, unknown> & {
    agent?: { name?: string };
    toJSON?: () => unknown;
  };
  const agentName = o.agent && typeof o.agent === "object" ? o.agent.name : undefined;
  let payload: unknown;
  try {
    payload = typeof o.toJSON === "function" ? o.toJSON() : JSON.parse(JSON.stringify(item, jsonReplacer));
  } catch {
    payload = { error: "run_item_not_serializable", type: o.type };
  }
  if (typeof agentName === "string") {
    return { agentName, item: payload };
  }
  return payload;
}

/**
 * Anexa uma linha NDJSON ao arquivo configurado. Falhas de I/O são engolidas
 * (log síncrono no stderr) para não derrubar o atendimento.
 */
export async function appendAgentRunRawLogLine(
  logPath: string,
  record: Record<string, unknown>,
): Promise<void> {
  let line: string;
  try {
    line = `${JSON.stringify(record, jsonReplacer)}\n`;
  } catch (e) {
    line = `${JSON.stringify({
      version: 1,
      at: new Date().toISOString(),
      error: "top_level_serialize_failed",
      message: e instanceof Error ? e.message : String(e),
    })}\n`;
  }

  try {
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, line, "utf8");
  } catch (e) {
    console.error(
      "[agent-run-raw-log] falha ao gravar arquivo:",
      logPath,
      e instanceof Error ? e.message : e,
    );
  }
}
