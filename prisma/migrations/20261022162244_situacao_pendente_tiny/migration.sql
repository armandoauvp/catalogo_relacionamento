-- AlterTable
ALTER TABLE "pedidos_tiny" ADD COLUMN     "situacao_pendente" TEXT;


-- A expedição só pede ao Tiny as duas situações que a pauta de 22/10/2026 define.
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_situacao_pendente_valida" CHECK (
  "situacao_pendente" IS NULL OR "situacao_pendente" IN ('preparando_envio', 'pronto_envio')
);
