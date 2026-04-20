# lia-customer-agents

Biblioteca TypeScript de agentes jurídicos (orquestrador + triagem + consulta processual) usando o [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/). Projetada para ser consumida pela edge function existente da Lia. É stateless e não faz persistência — quem chama é responsável por gravar mensagens/estados no Supabase.

## Arquitetura

```
edgeFunction -> runAgents(input) -> OrchestratorAgent
                                      |
                                      +--> TriageAgent (Direito do Trabalho)
                                      +--> ProcessInfoAgent --> legis-mcp
```

- `OrchestratorAgent` decide via handoff qual especialista atende.
- `TriageAgent` faz primeiro atendimento (prompt em `src/agents/instructions/triage.instructions.ts`).
- `ProcessInfoAgent` consulta processos existentes via MCP `legis-mcp`.
- Os headers do MCP são montados por execução a partir do `RunInput`.

## Instalação

```bash
npm install
```

## Scripts

- `npm run typecheck` — verifica tipos.
- `npm run build` — gera o pacote em `dist/`.
- `npm test` — roda os testes com Vitest.

## Uso

```ts
import { runAgents } from "lia-customer-agents";

const result = await runAgents({
  userMessage: "Oi, queria saber como está o andamento do meu processo",
  conversationId: "conv-123",
  organizationId: "org-456",
  clientId: "cli-789",
  calendarConnectionId: "cal-abc",  // opcional
  previousResponseId: "resp_abc123", // opcional, vindo da rodada anterior
});

console.log(result.output);       // texto final para o cliente
console.log(result.agentUsed);    // "triage" | "process_info"
console.log(result.responseId);   // response_id da OpenAI (persistir no Supabase)
console.log(result.usage);        // { requests, inputTokens, outputTokens, totalTokens }
```

### Encadeamento de conversa

A biblioteca não lê conversas anteriores do Supabase. Quem chama deve guardar o `response_id` da última execução e passá-lo como `previousResponseId` na próxima. O SDK cuida de montar o histórico a partir disso.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `OPENAI_API_KEY` | sim | Lida automaticamente pelo SDK da OpenAI. |
| `MCP_SERVER_URL` | sim (para consulta processual) | URL do servidor MCP `legis-mcp`. |
| `MCP_SERVER_API_KEY` | não | Quando presente, é enviado como `Authorization: Bearer ...` nos headers do MCP. |
| `AI_MODEL` | não | Modelo padrão. Default: `gpt-5-mini`. |

## Contrato

### `RunInput`

| Campo | Tipo | Obrigatório | Observações |
| --- | --- | --- | --- |
| `userMessage` | `string` | sim | Mensagem da rodada. |
| `conversationId` | `string` | sim | Enviado como `X-Conversation-Id`. |
| `organizationId` | `string` | sim | Enviado como `X-Organization-Id`. |
| `clientId` | `string` | sim | Enviado como `X-Client-Id`. |
| `calendarConnectionId` | `string` | não | Enviado como `X-Calendar-Connection-Id` quando presente. |
| `previousResponseId` | `string` | não | `response_id` retornado pela execução anterior. |
| `extra` | `Record<string, unknown>` | não | Contexto adicional do chamador. |

### `RunOutput`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `output` | `string` | Texto final para o usuário. |
| `agentUsed` | `"triage" \| "process_info"` | Especialista que produziu a resposta. |
| `responseId` | `string \| undefined` | Persistir para encadear a próxima rodada. |
| `usage` | `{ requests; inputTokens; outputTokens; totalTokens }` | Agregado do run. |

## Adicionando novos agentes

1. Criar o prompt em `src/agents/instructions/<novo>.instructions.ts`.
2. Criar a fábrica `buildXyzAgent` em `src/agents/<novo>.agent.ts`.
3. Registrar o agente como handoff em `src/agents/orchestrator.agent.ts` e incluir a regra de roteamento no prompt do orquestrador.
4. Se o agente precisar de MCP, reutilize `buildLegisMcpTool` ou crie uma nova fábrica em `src/mcp/`.

## O que a biblioteca NÃO faz

- Não grava em `whatsapp_mensagens`, `whatsapp_conversation_responses`, `whatsapp_conversation_states`, `whatsapp_atendimentos`.
- Não lê conversa prévia do Supabase — o encadeamento é via `previousResponseId`.
- Não cria edge function própria — ela é consumida pela edge function existente.
