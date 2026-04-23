import {
  RunContext,
  RunMessageOutputItem,
  RunToolCallItem,
  RunToolCallOutputItem,
  type AgentInputItem,
  type HandoffInputData,
} from "@openai/agents-core";
import { describe, expect, it } from "vitest";
import { cleanHandoffHistory } from "../src/agents/handoff-filters.js";

/**
 * Stub mínimo de Agent — `removeAllTools` (e os filtros) só inspecionam
 * `item.agent.name` para identificar o autor do item; a referência real do
 * agente não é tocada. Cast para `any` evita arrastar a tipagem completa
 * do construtor de Agent num teste de filtro puro.
 */
const fakeAgent = { name: "fake-agent" } as unknown as Parameters<
  typeof RunMessageOutputItem
>[1];

function makeAssistantTextItem(text: string) {
  return new RunMessageOutputItem(
    {
      id: `msg-${text.slice(0, 4)}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text }],
    },
    fakeAgent,
  );
}

function makeToolCallItem(callId: string) {
  return new RunToolCallItem(
    {
      id: `tc-${callId}`,
      type: "function_call",
      callId,
      name: "getPerson",
      arguments: "{}",
      status: "completed",
    },
    fakeAgent,
  );
}

function makeToolCallOutputItem(callId: string) {
  return new RunToolCallOutputItem(
    {
      type: "function_call_result",
      callId,
      name: "getPerson",
      status: "completed",
      output: { type: "text", text: "ok" },
    },
    fakeAgent,
    "ok",
  );
}

const inputHistoryFixture: AgentInputItem[] = [
  {
    type: "message",
    role: "user",
    content: "oi, sou cliente",
  } as AgentInputItem,
  {
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: "Olá! Você é cliente?" }],
  } as AgentInputItem,
  {
    type: "function_call",
    callId: "call-1",
    name: "getPerson",
    arguments: "{}",
    status: "completed",
  } as AgentInputItem,
  {
    type: "function_call_result",
    callId: "call-1",
    name: "getPerson",
    status: "completed",
    output: { type: "text", text: "ok" },
  } as AgentInputItem,
  {
    type: "reasoning",
    id: "rs-1",
  } as AgentInputItem,
];

describe("cleanHandoffHistory", () => {
  it("preserva inputHistory integralmente (pass-through)", () => {
    const data: HandoffInputData = {
      inputHistory: inputHistoryFixture,
      preHandoffItems: [],
      newItems: [],
    };

    const result = cleanHandoffHistory(data);
    const history = result.inputHistory as AgentInputItem[];

    expect(Array.isArray(history)).toBe(true);
    expect(history).toEqual(inputHistoryFixture);
  });

  it("preserva preHandoffItems e newItems sem filtrar", () => {
    const userMsg = makeAssistantTextItem("Olá!");
    const toolCall = makeToolCallItem("call-1");
    const toolOut = makeToolCallOutputItem("call-1");
    const followUp = makeAssistantTextItem("Beleza, Maria!");

    const data: HandoffInputData = {
      inputHistory: [],
      preHandoffItems: [userMsg, toolCall, toolOut],
      newItems: [followUp, toolCall],
    };

    const result = cleanHandoffHistory(data);

    expect(result.preHandoffItems).toEqual([userMsg, toolCall, toolOut]);
    expect(result.newItems).toEqual([followUp, toolCall]);
  });

  it("preserva runContext sem alterações", () => {
    const ctx = new RunContext<{ id: string }>({ id: "ctx-1" });
    const data: HandoffInputData = {
      inputHistory: [],
      preHandoffItems: [],
      newItems: [],
      runContext: ctx,
    };

    const result = cleanHandoffHistory(data);
    expect(result.runContext).toBe(ctx);
  });

  it("preserva inputHistory string sem mudanças (não há tool calls em string)", () => {
    const data: HandoffInputData = {
      inputHistory: "olá, sou cliente",
      preHandoffItems: [],
      newItems: [],
    };

    const result = cleanHandoffHistory(data);
    expect(result.inputHistory).toBe("olá, sou cliente");
  });
});
