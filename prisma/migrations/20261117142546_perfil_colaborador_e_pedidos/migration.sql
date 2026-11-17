-- AlterEnum
ALTER TYPE "OrigemDemanda" ADD VALUE 'pedido';

-- AlterEnum
ALTER TYPE "Perfil" ADD VALUE 'colaborador';

-- AlterTable
ALTER TABLE "demandas_logistica" ADD COLUMN     "solicitante_id" TEXT;

-- CreateIndex
CREATE INDEX "demandas_logistica_solicitante_id_idx" ON "demandas_logistica"("solicitante_id");

-- AddForeignKey
ALTER TABLE "demandas_logistica" ADD CONSTRAINT "demandas_logistica_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
