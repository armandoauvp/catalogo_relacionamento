-- AlterTable
ALTER TABLE "eventos_tiny" ADD COLUMN     "usuario_id" TEXT;

-- CreateIndex
CREATE INDEX "eventos_tiny_usuario_id_idx" ON "eventos_tiny"("usuario_id");

-- CreateIndex
CREATE INDEX "eventos_tiny_tipo_idx" ON "eventos_tiny"("tipo");

-- AddForeignKey
ALTER TABLE "eventos_tiny" ADD CONSTRAINT "eventos_tiny_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
