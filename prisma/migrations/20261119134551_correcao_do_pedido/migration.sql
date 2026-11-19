-- AlterTable
ALTER TABLE "solicitacao_itens" ADD COLUMN     "do_estoque" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "solicitacao_alteracoes" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "campo" TEXT NOT NULL,
    "antes" TEXT,
    "depois" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_alteracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacao_alteracoes_solicitacao_id_criado_em_idx" ON "solicitacao_alteracoes"("solicitacao_id", "criado_em");

-- AddForeignKey
ALTER TABLE "solicitacao_alteracoes" ADD CONSTRAINT "solicitacao_alteracoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_alteracoes" ADD CONSTRAINT "solicitacao_alteracoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "Do estoque" é só para presente específico: o item do catálogo segue a
-- origem do produto, e as duas regras não podem disputar o mesmo item.
ALTER TABLE "solicitacao_itens"
  ADD CONSTRAINT "item_do_estoque_so_especifico" CHECK (
    "do_estoque" = false OR "produto_id" IS NULL
  );
