/**
 * Leitura de variáveis de ambiente da biblioteca.
 *
 * O runtime alvo é Deno (edge function existente), mas o código é escrito para
 * funcionar também em Node. Em Deno, `process.env` é espelhado automaticamente
 * quando `--unstable-node-globals` está ativo; caso contrário, a função
 * `readEnv` cobre ambos os cenários.
 */

type EnvHost = {
  process?: { env?: Record<string, string | undefined> };
  Deno?: { env?: { get(name: string): string | undefined } };
};

function readEnv(name: string): string | undefined {
  const host = globalThis as unknown as EnvHost;

  const fromProcess = host.process?.env?.[name];
  if (typeof fromProcess === "string" && fromProcess.length > 0) {
    return fromProcess;
  }

  const fromDeno = host.Deno?.env?.get?.(name);
  if (typeof fromDeno === "string" && fromDeno.length > 0) {
    return fromDeno;
  }

  return undefined;
}

export interface EnvConfig {
  /** Modelo OpenAI padrão. */
  readonly aiModel: string;
  /** URL do MCP legis. */
  readonly mcpServerUrl: string | undefined;
  /** API key opcional do MCP. */
  readonly mcpServerApiKey: string | undefined;
}

const DEFAULT_MODEL = "gpt-5-mini";

/**
 * Constrói o objeto de ambiente. Chamada no startup; falhas são lançadas pelo
 * chamador quando faltar alguma configuração crítica.
 */
export function loadEnv(): EnvConfig {
  return {
    aiModel: readEnv("AI_MODEL") ?? DEFAULT_MODEL,
    mcpServerUrl: readEnv("MCP_SERVER_URL"),
    mcpServerApiKey: readEnv("MCP_SERVER_API_KEY"),
  };
}
