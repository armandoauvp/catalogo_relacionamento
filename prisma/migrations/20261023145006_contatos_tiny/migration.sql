-- CreateTable
CREATE TABLE "contatos_tiny" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "linha" INTEGER,
    "cpf_cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "tiny_id" TEXT,
    "envio" "EnvioTiny" NOT NULL DEFAULT 'pendente',
    "resultado" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proxima_tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erro" TEXT,
    "criado_por_id" TEXT,
    "enviado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_tiny_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contatos_tiny_envio_proxima_tentativa_em_idx" ON "contatos_tiny"("envio", "proxima_tentativa_em");

-- CreateIndex
CREATE INDEX "contatos_tiny_cpf_cnpj_idx" ON "contatos_tiny"("cpf_cnpj");

-- CreateIndex
CREATE INDEX "contatos_tiny_criado_em_idx" ON "contatos_tiny"("criado_em");

-- AddForeignKey
ALTER TABLE "contatos_tiny" ADD CONSTRAINT "contatos_tiny_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contatos_tiny" ADD CONSTRAINT "contato_tiny_tentativas_nao_negativas" CHECK ("tentativas" >= 0);
ALTER TABLE "contatos_tiny" ADD CONSTRAINT "contato_tiny_enviado_tem_data" CHECK ("envio" <> 'enviado' OR "enviado_em" IS NOT NULL);
