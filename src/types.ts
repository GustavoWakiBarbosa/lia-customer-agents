import { z } from "zod";

/**
 * Identificadores dos agentes suportados no orquestrador.
 *
 * `triage` — Lia de primeiro atendimento (triagem de casos)
 * `process_info` — Lia de consulta a processos já existentes
 */
export const AgentIdSchema = z.enum(["triage", "process_info"]);
export type AgentId = z.infer<typeof AgentIdSchema>;

/**
 * Contrato de entrada para `runAgents`.
 *
 * Todo o contexto necessário para executar os agentes é passado pelo chamador
 * (a edge function que hospeda a biblioteca). A biblioteca é stateless.
 */
export const RunInputSchema = z.object({
  /** Mensagem do usuário para a rodada atual. */
  userMessage: z.string().min(1, "userMessage must not be empty"),

  /** Identificador da conversa do canal (ex.: WhatsApp). */
  conversationId: z.string().min(1),

  /** Identificador da organização/escritório. */
  organizationId: z.string().min(1),

  /** Identificador da pessoa/cliente associado à conversa. */
  clientId: z.string().min(1),

  /** Conexão de calendário do escritório, quando aplicável (agendamentos). */
  calendarConnectionId: z.string().min(1).optional(),

  /**
   * `response_id` retornado pela OpenAI na rodada anterior. Quando presente,
   * é usado para encadear a conversa via `previousResponseId` do SDK.
   */
  previousResponseId: z.string().min(1).optional(),

  /**
   * Extras passados pelo chamador (ex.: nome do cliente). Não interferem no
   * contrato do SDK; podem ser utilizados pelos agentes via instruções.
   */
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type RunInput = z.infer<typeof RunInputSchema>;

/**
 * Métricas de uso agregadas do run.
 */
export interface RunUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Contrato de saída de `runAgents`.
 */
export interface RunOutput {
  /** Texto final destinado ao usuário. */
  output: string;

  /** Agente que produziu a resposta final. */
  agentUsed: AgentId;

  /** `response_id` retornado pela OpenAI (deve ser persistido pela edge function). */
  responseId: string | undefined;

  /** Métricas agregadas do run. */
  usage: RunUsage;
}

/**
 * Contexto compartilhado entre agentes e ferramentas durante um `run`.
 * Não é exposto na API pública, mas é injetado no `RunContext` do SDK para
 * permitir que ferramentas acessem identificadores do tenant.
 */
export interface AgentRunContext {
  conversationId: string;
  organizationId: string;
  clientId: string;
  calendarConnectionId: string | undefined;
  extra: Record<string, unknown> | undefined;
}
