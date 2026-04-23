import {
  RunMessageOutputItem,
  RunToolCallItem,
} from "@openai/agents-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeAgentRunPipeline } from "../src/runtime/run-agents.js";

const fakeAgent = (name: string) =>
  ({ name }) as unknown as Parameters<typeof RunMessageOutputItem>[1];

function makeMessage(agentName: string, text: string) {
  return new RunMessageOutputItem(
    {
      id: `msg-${agentName}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text }],
    },
    fakeAgent(agentName),
  );
}

function makeToolCall(agentName: string, callId: string) {
  return new RunToolCallItem(
    {
      id: `tc-${callId}`,
      type: "function_call",
      callId,
      name: "getPerson",
      arguments: "{}",
      status: "completed",
    },
    fakeAgent(agentName),
  );
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("summarizeAgentRunPipeline — soft promise warning", () => {
  it("não avisa quando o agente disse 'vou consultar' E chamou uma tool no mesmo run", () => {
    const items = [
      makeMessage("process_info", "Vou consultar o seu processo agora."),
      makeToolCall("process_info", "call-1"),
    ];

    const counts = summarizeAgentRunPipeline("conv-test", items);

    expect(counts.toolCalls).toBe(1);
    expect(counts.messageOutputs).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("avisa quando o agente disse 'vou consultar' SEM chamar nenhuma tool", () => {
    const items = [
      makeMessage(
        "process_info",
        "Vou consultar o andamento do seu processo e já te retorno.",
      ),
    ];

    const counts = summarizeAgentRunPipeline("conv-test", items);

    expect(counts.toolCalls).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const args = warnSpy.mock.calls[0]?.[0] as string;
    expect(args).toContain("Possível promessa sem ação detectada");
    expect(args).toContain("consulta processual");
  });

  it("não avisa quando o texto do agente não contém nenhum gatilho de promessa", () => {
    const items = [
      makeMessage(
        "process_info",
        "Encontrei seu processo. A última movimentação foi ontem.",
      ),
    ];

    summarizeAgentRunPipeline("conv-test", items);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("avisa quando o texto contém 'vou buscar' sem tool no mesmo run", () => {
    const items = [
      makeMessage(
        "orchestrator",
        "Consigo sim. Vou buscar pelo CPF e já te retorno.",
      ),
    ];

    summarizeAgentRunPipeline("conv-test", items);

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("avisa por agente: orchestrator promete sem tool, process_info promete com tool", () => {
    const items = [
      makeMessage("orchestrator", "Aguarde um momento, vou te transferir."),
      makeMessage("process_info", "Vou consultar isso para você."),
      makeToolCall("process_info", "call-1"),
    ];

    summarizeAgentRunPipeline("conv-test", items);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const args = warnSpy.mock.calls[0]?.[0] as string;
    expect(args).toContain("recepção");
  });
});
