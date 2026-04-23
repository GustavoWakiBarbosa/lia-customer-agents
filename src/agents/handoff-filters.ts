import type { HandoffInputData } from "@openai/agents-core";

/**
 * Filtro de input aplicado a todo `handoff()` do orquestrador.
 *
 * Pass-through completo: não remove nenhum item do histórico.
 * Mantemos o helper para poder reativar filtros no futuro sem alterar
 * o wiring dos `handoff()` no orquestrador.
 */
export function cleanHandoffHistory(input: HandoffInputData): HandoffInputData {
  return input;
}
