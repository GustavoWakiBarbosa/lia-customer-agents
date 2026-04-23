import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendAgentRunRawLogLine,
  buildAgentRunRawLogRecord,
  resolveAgentRunRawLogPath,
} from "../src/runtime/agent-run-raw-log.js";

describe("resolveAgentRunRawLogPath", () => {
  const savedDisable = process.env.AGENT_RUN_RAW_LOG_DISABLE;
  const savedPath = process.env.AGENT_RUN_RAW_LOG_PATH;

  afterEach(() => {
    if (savedDisable === undefined) {
      delete process.env.AGENT_RUN_RAW_LOG_DISABLE;
    } else {
      process.env.AGENT_RUN_RAW_LOG_DISABLE = savedDisable;
    }
    if (savedPath === undefined) {
      delete process.env.AGENT_RUN_RAW_LOG_PATH;
    } else {
      process.env.AGENT_RUN_RAW_LOG_PATH = savedPath;
    }
  });

  it("retorna undefined quando AGENT_RUN_RAW_LOG_DISABLE=1", () => {
    process.env.AGENT_RUN_RAW_LOG_DISABLE = "1";
    delete process.env.AGENT_RUN_RAW_LOG_PATH;
    expect(resolveAgentRunRawLogPath()).toBeUndefined();
  });

  it("usa caminho explícito quando AGENT_RUN_RAW_LOG_PATH está definido", () => {
    delete process.env.AGENT_RUN_RAW_LOG_DISABLE;
    process.env.AGENT_RUN_RAW_LOG_PATH = "/tmp/custom.ndjson";
    expect(resolveAgentRunRawLogPath()).toBe("/tmp/custom.ndjson");
  });

  it("usa logs/agent-runs.ndjson por padrão", () => {
    delete process.env.AGENT_RUN_RAW_LOG_DISABLE;
    delete process.env.AGENT_RUN_RAW_LOG_PATH;
    expect(resolveAgentRunRawLogPath()).toBe("logs/agent-runs.ndjson");
  });
});

describe("buildAgentRunRawLogRecord", () => {
  it("inclui state, runContext, newItems com agentName e item toJSON", () => {
    const result = {
      input: "oi",
      newItems: [
        {
          agent: { name: "orchestrator" },
          toJSON: () => ({ type: "message", body: 1 }),
        },
      ],
      output: [{ role: "assistant", content: "a" }],
      history: [],
      finalOutput: "resposta",
      lastResponseId: "resp_1",
      lastAgent: { name: "orchestrator" },
      rawResponses: [{ id: "mr1" }],
      inputGuardrailResults: [],
      outputGuardrailResults: [],
      toolInputGuardrailResults: [],
      toolOutputGuardrailResults: [],
      interruptions: [],
      state: { toJSON: () => ({ serialized: true }) },
      runContext: {
        toJSON: () => ({
          context: { conversaId: "c1" },
          usage: { requests: 1 },
          approvals: {},
        }),
      },
    };

    const rec = buildAgentRunRawLogRecord({
      conversaId: "c1",
      organizationId: "o1",
      clientId: "p1",
      openaiConversationId: "conv_a",
      model: "gpt-test",
      result,
    });

    expect(rec.version).toBe(1);
    expect(rec.conversaId).toBe("c1");
    expect(rec.organizationId).toBe("o1");
    expect(rec.clientId).toBe("p1");
    expect(rec.openaiConversationId).toBe("conv_a");
    expect(rec.model).toBe("gpt-test");

    const runResult = rec.runResult as {
      state: unknown;
      runContext: unknown;
      newItems: unknown[];
      finalOutput: string;
    };
    expect(runResult.state).toEqual({ serialized: true });
    expect(runResult.runContext).toMatchObject({
      context: { conversaId: "c1" },
    });
    expect(runResult.finalOutput).toBe("resposta");
    expect(runResult.newItems[0]).toEqual({
      agentName: "orchestrator",
      item: { type: "message", body: 1 },
    });
  });
});

describe("appendAgentRunRawLogLine", () => {
  it("grava uma linha NDJSON válida", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lia-raw-log-"));
    const file = join(dir, "out.ndjson");
    await appendAgentRunRawLogLine(file, { k: 1, s: "x" });
    const txt = await readFile(file, "utf8");
    expect(JSON.parse(txt.trim())).toEqual({ k: 1, s: "x" });
    await rm(dir, { recursive: true });
  });
});
