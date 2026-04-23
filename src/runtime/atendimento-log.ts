/** Logs de depuração do fluxo de atendimento (prefixo `[atendimento …]`). */

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function logAgentLine(conversationId: string, message: string): void {
  console.log(`[atendimento ${shortId(conversationId)}] ${message}`);
}

/** Loga um bloco de texto com o mesmo prefixo de atendimento em cada linha. */
export function logAgentTextBlock(
  conversationId: string,
  header: string,
  text: string,
): void {
  logAgentLine(conversationId, header);
  for (const line of text.split("\n")) {
    logAgentLine(conversationId, `  ${line}`);
  }
}

export function warnAgentLine(conversationId: string, message: string): void {
  console.warn(`[atendimento ${shortId(conversationId)}] ${message}`);
}
