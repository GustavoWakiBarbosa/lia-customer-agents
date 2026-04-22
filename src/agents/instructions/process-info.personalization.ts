import type { ChatbotAiConfig } from "../../db/chatbotAiConfig.js";
import {
  getCachedInstructions,
  setCachedInstructions,
} from "./process-info.instructionsCache.js";
import {
  PROCESS_INFO_BASE_INSTRUCTIONS,
  PROCESS_INFO_DEFAULT_STYLE_INSTRUCTIONS,
  buildStyleInstructions,
  buildUpdateInstructions,
  buildVocabularyInstructions,
  getTranshipmentMenuInstructions,
} from "./process-info.instructions.js";

export interface BuildProcessInfoInstructionsParams {
  /** Config da org (`chatbot_ai_config`) ou `null` quando ausente/ inválida. */
  readonly config: ChatbotAiConfig | null;
  /** Quando presente, anexa o bloco de transbordo com agendamento. */
  readonly calendarConnectionId?: string | undefined;
  /**
   * Quando presente, ativa o cache em memória da string final (TTL 10 min).
   * Sem org o build é executado toda vez — útil em testes e chamadas
   * sintéticas.
   */
  readonly organizationId?: string | undefined;
}

/**
 * Compõe as instruções finais do agente `process_info`.
 *
 * Estrutura final:
 *  1. `PROCESS_INFO_BASE_INSTRUCTIONS` (sempre).
 *  2. Estilo + vocabulário + comunicação de atualizações:
 *     - sem config → `PROCESS_INFO_DEFAULT_STYLE_INSTRUCTIONS`
 *     - com config → blocos derivados de `tom_voz` / `vocabulario` /
 *       `tipo_atualizacao` + `palavras_chave_filtro`.
 *  3. Bloco de transbordo (`getTranshipmentMenuInstructions()`) quando há
 *     `calendarConnectionId`.
 *
 * Quando `organizationId` é passado, o resultado é cacheado por até 10 min,
 * invalidando automaticamente se a config ou a presença do calendário mudar.
 */
export function buildProcessInfoInstructions(
  params: BuildProcessInfoInstructionsParams,
): string {
  const { config, calendarConnectionId, organizationId } = params;
  const hasCalendar = Boolean(calendarConnectionId);

  if (organizationId) {
    const cached = getCachedInstructions(organizationId, config, hasCalendar);
    if (cached) return cached;
  }

  const instructions = composeInstructions(config, hasCalendar);

  if (organizationId) {
    setCachedInstructions(organizationId, instructions, config, hasCalendar);
  }

  return instructions;
}

function composeInstructions(
  config: ChatbotAiConfig | null,
  hasCalendar: boolean,
): string {
  const transhipment = hasCalendar ? getTranshipmentMenuInstructions() : "";

  if (!config) {
    return (
      PROCESS_INFO_BASE_INSTRUCTIONS +
      PROCESS_INFO_DEFAULT_STYLE_INSTRUCTIONS +
      transhipment
    );
  }

  return (
    PROCESS_INFO_BASE_INSTRUCTIONS +
    buildStyleInstructions(config.tom_voz) +
    buildVocabularyInstructions(config.vocabulario) +
    buildUpdateInstructions(
      config.tipo_atualizacao,
      config.palavras_chave_filtro,
    ) +
    transhipment
  );
}
