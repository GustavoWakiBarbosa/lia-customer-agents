-- Persist the OpenAI Conversations API thread id (conv_...) per active service.
-- This lets stateless workers recreate OpenAIConversationsSession across requests.
ALTER TABLE whatsapp_atendimentos
ADD COLUMN IF NOT EXISTS openai_conversation_id TEXT;

COMMENT ON COLUMN whatsapp_atendimentos.openai_conversation_id IS
  'OpenAI Conversations API id (conv_...) bound to this atendimento lifecycle.';

-- Partial index to speed lookups for active services in generate-ai-response.
CREATE INDEX IF NOT EXISTS idx_whatsapp_atendimentos_active_openai_conversation
  ON whatsapp_atendimentos (conversa_id, openai_conversation_id)
  WHERE finalizado_em IS NULL;
