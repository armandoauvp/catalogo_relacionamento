-- AlterEnum
ALTER TYPE "OrigemPedidoTiny" ADD VALUE 'avulso';

-- AlterTable
ALTER TABLE "pedidos_tiny" ADD COLUMN     "criado_por_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedidos_tiny_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O avulso não tem solicitação nem lote. A comparação é por texto porque o
-- Postgres não deixa usar o valor de enum novo na transação que o criou.
ALTER TABLE "pedidos_tiny" DROP CONSTRAINT "pedido_tiny_tem_origem";
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_tem_origem" CHECK (
  ("origem"::text = 'solicitacao' AND "solicitacao_id" IS NOT NULL AND "lote_id" IS NULL)
  OR ("origem"::text = 'lote' AND "lote_id" IS NOT NULL AND "linha" IS NOT NULL AND "solicitacao_id" IS NULL)
  OR ("origem"::text = 'avulso' AND "solicitacao_id" IS NULL AND "lote_id" IS NULL)
);
