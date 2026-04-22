import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { ChatbotAiConfig } from "../src/db/chatbotAiConfig.js";
import {
  __resetInstructionsCacheForTests,
  invalidateInstructionsCache,
} from "../src/agents/instructions/process-info.instructionsCache.js";
import { buildProcessInfoInstructions } from "../src/agents/instructions/process-info.personalization.js";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

function makeConfig(overrides: Partial<ChatbotAiConfig> = {}): ChatbotAiConfig {
  return {
    tom_voz: "profissional",
    vocabulario: "leigo",
    tipo_atualizacao: "publicacao",
    palavras_chave_filtro: [],
    ...overrides,
  };
}

beforeEach(() => {
  __resetInstructionsCacheForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildProcessInfoInstructions — cache de instruções", () => {
  it("retorna exatamente a mesma string em chamadas consecutivas (hit)", () => {
    const params = {
      config: makeConfig({ tom_voz: "empatico" }),
      organizationId: ORG_A,
    } as const;

    const first = buildProcessInfoInstructions(params);
    const second = buildProcessInfoInstructions(params);

    expect(second).toBe(first);
  });

  it("invalida cache quando tom_voz muda (config hash diferente)", () => {
    const r1 = buildProcessInfoInstructions({
      config: makeConfig({ tom_voz: "profissional" }),
      organizationId: ORG_A,
    });
    const r2 = buildProcessInfoInstructions({
      config: makeConfig({ tom_voz: "energico" }),
      organizationId: ORG_A,
    });

    expect(r1).not.toBe(r2);
    expect(r1).toContain("Seja direto e profissional");
    expect(r2).toContain("Enérgico, confiante e proativo");
  });

  it("invalida cache quando palavras_chave_filtro mudam", () => {
    const r1 = buildProcessInfoInstructions({
      config: makeConfig({
        tipo_atualizacao: "publicacao",
        palavras_chave_filtro: ["sigilo"],
      }),
      organizationId: ORG_A,
    });
    const r2 = buildProcessInfoInstructions({
      config: makeConfig({
        tipo_atualizacao: "publicacao",
        palavras_chave_filtro: ["sigilo", "urgencia"],
      }),
      organizationId: ORG_A,
    });

    expect(r1).toContain("(sigilo)");
    expect(r2).toContain("(sigilo, urgencia)");
  });

  it("invalida cache quando calendarConnectionId liga/desliga (correção do bug)", () => {
    const base = makeConfig();

    const semCal = buildProcessInfoInstructions({
      config: base,
      organizationId: ORG_A,
    });
    const comCal = buildProcessInfoInstructions({
      config: base,
      organizationId: ORG_A,
      calendarConnectionId: "cal-1",
    });
    const semCalDeNovo = buildProcessInfoInstructions({
      config: base,
      organizationId: ORG_A,
    });

    expect(semCal).not.toContain("### REGRA ESPECIAL: Transbordo");
    expect(comCal).toContain("### REGRA ESPECIAL: Transbordo");
    expect(semCalDeNovo).toBe(semCal);
  });

  it("não usa cache de outra org (isolamento por chave)", () => {
    const resultA = buildProcessInfoInstructions({
      config: makeConfig({ tom_voz: "profissional" }),
      organizationId: ORG_A,
    });
    const resultB = buildProcessInfoInstructions({
      config: makeConfig({ tom_voz: "empatico" }),
      organizationId: ORG_B,
    });

    expect(resultA).toContain("Seja direto e profissional");
    expect(resultB).toContain("Acolhedor, empático");
  });

  it("TTL de 10 minutos força rebuild", () => {
    const config = makeConfig({ tom_voz: "profissional" });

    const r1 = buildProcessInfoInstructions({
      config,
      organizationId: ORG_A,
    });

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    const r2 = buildProcessInfoInstructions({
      config,
      organizationId: ORG_A,
    });

    expect(r2).toEqual(r1);
  });

  it("invalidateInstructionsCache remove entrada específica", () => {
    const config = makeConfig({ tom_voz: "profissional" });
    buildProcessInfoInstructions({ config, organizationId: ORG_A });

    invalidateInstructionsCache(ORG_A);

    const novoConfig = makeConfig({ tom_voz: "empatico" });
    const result = buildProcessInfoInstructions({
      config: novoConfig,
      organizationId: ORG_A,
    });

    expect(result).toContain("Acolhedor, empático");
  });

  it("sem organizationId: não cacheia (rebuild sempre, não interfere em outras chamadas)", () => {
    const cfg1 = makeConfig({ tom_voz: "profissional" });
    const cfg2 = makeConfig({ tom_voz: "empatico" });

    const r1 = buildProcessInfoInstructions({ config: cfg1 });
    const r2 = buildProcessInfoInstructions({ config: cfg2 });

    expect(r1).toContain("Seja direto e profissional");
    expect(r2).toContain("Acolhedor, empático");
  });

  it("config null também é cacheada por org (com TTL)", () => {
    const r1 = buildProcessInfoInstructions({
      config: null,
      organizationId: ORG_A,
    });
    const r2 = buildProcessInfoInstructions({
      config: null,
      organizationId: ORG_A,
    });

    expect(r2).toBe(r1);
    expect(r1).toContain("Tom: Formal, objetivo e claro");
  });
});
