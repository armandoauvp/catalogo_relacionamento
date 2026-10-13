-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('semanal', 'quinzenal', 'mensal');

-- AlterTable
ALTER TABLE "demandas_logistica" DROP COLUMN "minutos_apontados",
ADD COLUMN     "ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "custo_envio" DECIMAL(12,2),
ADD COLUMN     "ocorrencia_anterior_id" TEXT,
ADD COLUMN     "periodicidade" "Periodicidade",
ADD COLUMN     "recorrente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solicitacao_id" TEXT,
ALTER COLUMN "origem" SET DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX "demandas_logistica_ocorrencia_anterior_id_key" ON "demandas_logistica"("ocorrencia_anterior_id");

-- CreateIndex
CREATE UNIQUE INDEX "demandas_logistica_solicitacao_id_key" ON "demandas_logistica"("solicitacao_id");

-- CreateIndex
CREATE INDEX "demandas_logistica_ativa_idx" ON "demandas_logistica"("ativa");

-- AddForeignKey
ALTER TABLE "demandas_logistica" ADD CONSTRAINT "demandas_logistica_ocorrencia_anterior_id_fkey" FOREIGN KEY ("ocorrencia_anterior_id") REFERENCES "demandas_logistica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandas_logistica" ADD CONSTRAINT "demandas_logistica_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras que nenhum script pode furar.

-- Custo de envio não é negativo; nulo é "não informado".
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "custo_envio_nao_negativo" CHECK ("custo_envio" IS NULL OR "custo_envio" >= 0);

-- Recorrente sabe de quanto em quanto tempo volta.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "recorrente_tem_periodicidade" CHECK (NOT "recorrente" OR "periodicidade" IS NOT NULL);

-- A demanda que veio de um presente aponta para ele.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "demanda_de_solicitacao_tem_solicitacao" CHECK (
    "origem" <> 'solicitacao' OR "solicitacao_id" IS NOT NULL
  );

-- Uma ocorrência não é a anterior de si mesma.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "ocorrencia_anterior_e_outra" CHECK ("ocorrencia_anterior_id" <> "id");
