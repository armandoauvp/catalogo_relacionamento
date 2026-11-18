-- AlterTable
ALTER TABLE "solicitacao_itens" ADD COLUMN     "comprado_em" TIMESTAMP(3),
ADD COLUMN     "comprado_por_id" TEXT;

-- CreateIndex
CREATE INDEX "solicitacao_itens_comprado_por_id_idx" ON "solicitacao_itens"("comprado_por_id");

-- AddForeignKey
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_comprado_por_id_fkey" FOREIGN KEY ("comprado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data e autor da compra andam juntos: item comprado sem quem comprou (ou o
-- contrário) não tem como ser auditado.
ALTER TABLE "solicitacao_itens" ADD CONSTRAINT "solicitacao_itens_comprado_junto_check"
  CHECK (("comprado_em" IS NULL) = ("comprado_por_id" IS NULL));
