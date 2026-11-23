-- CreateEnum
CREATE TYPE "TomDaNotificacao" AS ENUM ('comum', 'entrega', 'alerta');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "solicitacao_id" TEXT,
    "tom" "TomDaNotificacao" NOT NULL DEFAULT 'comum',
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "lida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_usuario_id_lida_em_idx" ON "notificacoes"("usuario_id", "lida_em");

-- CreateIndex
CREATE INDEX "notificacoes_usuario_id_criado_em_idx" ON "notificacoes"("usuario_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_usuario_id_chave_key" ON "notificacoes"("usuario_id", "chave");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
