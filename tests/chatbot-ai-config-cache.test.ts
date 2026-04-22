import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();

const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("../src/db/client.js", () => ({
  getSupabaseClient: () => ({ from: fromMock }),
}));

import {
  __resetChatbotAiConfigCacheForTests,
  getChatbotAiConfig,
  invalidateChatbotAiConfigCache,
} from "../src/db/chatbotAiConfig.js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

function mockOnce(data: unknown, error: unknown = null): void {
  maybeSingleMock.mockResolvedValueOnce({ data, error });
}

beforeEach(() => {
  __resetChatbotAiConfigCacheForTests();
  maybeSingleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getChatbotAiConfig — cache em memória", () => {
  it("faz apenas 1 SELECT quando chamado em sequência dentro do TTL", async () => {
    mockOnce({
      tom_voz: "profissional",
      vocabulario: "leigo",
      tipo_atualizacao: "publicacao",
      palavras_chave_filtro: ["sigilo"],
    });

    const first = await getChatbotAiConfig(ORG_ID);
    const second = await getChatbotAiConfig(ORG_ID);

    expect(first).toEqual(second);
    expect(first?.tom_voz).toBe("profissional");
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("cacheia `null` quando não há linha cadastrada (evita SELECT repetido)", async () => {
    mockOnce(null);

    const first = await getChatbotAiConfig(ORG_ID);
    const second = await getChatbotAiConfig(ORG_ID);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("cacheia `null` quando erro de I/O é retornado pelo Supabase", async () => {
    mockOnce(null, { message: "boom" });

    const result = await getChatbotAiConfig(ORG_ID);
    await getChatbotAiConfig(ORG_ID);

    expect(result).toBeNull();
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("refaz SELECT após o TTL de 5 minutos vencer", async () => {
    mockOnce({
      tom_voz: "empatico",
      vocabulario: "intermediario",
      tipo_atualizacao: "todas",
      palavras_chave_filtro: [],
    });

    await getChatbotAiConfig(ORG_ID);
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    mockOnce({
      tom_voz: "energico",
      vocabulario: "intermediario",
      tipo_atualizacao: "todas",
      palavras_chave_filtro: [],
    });

    const result = await getChatbotAiConfig(ORG_ID);

    expect(result?.tom_voz).toBe("energico");
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("invalidateChatbotAiConfigCache força novo SELECT antes do TTL", async () => {
    mockOnce({
      tom_voz: "profissional",
      vocabulario: "leigo",
      tipo_atualizacao: "publicacao",
      palavras_chave_filtro: [],
    });

    await getChatbotAiConfig(ORG_ID);
    invalidateChatbotAiConfigCache(ORG_ID);

    mockOnce({
      tom_voz: "profissional",
      vocabulario: "leigo",
      tipo_atualizacao: "publicacao",
      palavras_chave_filtro: ["novo-termo"],
    });

    const result = await getChatbotAiConfig(ORG_ID);

    expect(result?.palavras_chave_filtro).toEqual(["novo-termo"]);
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("orgs diferentes têm slots independentes no cache", async () => {
    const otherOrgId = "22222222-2222-2222-2222-222222222222";

    mockOnce({
      tom_voz: "profissional",
      vocabulario: "leigo",
      tipo_atualizacao: "publicacao",
      palavras_chave_filtro: [],
    });
    mockOnce({
      tom_voz: "empatico",
      vocabulario: "intermediario",
      tipo_atualizacao: "todas",
      palavras_chave_filtro: [],
    });

    const a1 = await getChatbotAiConfig(ORG_ID);
    const b1 = await getChatbotAiConfig(otherOrgId);
    const a2 = await getChatbotAiConfig(ORG_ID);
    const b2 = await getChatbotAiConfig(otherOrgId);

    expect(a1?.tom_voz).toBe("profissional");
    expect(b1?.tom_voz).toBe("empatico");
    expect(a2).toEqual(a1);
    expect(b2).toEqual(b1);
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("cacheia `null` quando o shape do banco é inválido", async () => {
    mockOnce({
      tom_voz: "valor-novo-no-banco",
      vocabulario: "leigo",
      tipo_atualizacao: "publicacao",
      palavras_chave_filtro: [],
    });

    const first = await getChatbotAiConfig(ORG_ID);
    const second = await getChatbotAiConfig(ORG_ID);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });
});
