-- CreateEnum
CREATE TYPE "OrigemPedidoTiny" AS ENUM ('solicitacao', 'lote');

-- CreateEnum
CREATE TYPE "EnvioTiny" AS ENUM ('pendente', 'processando', 'enviado', 'falhou');

-- CreateTable
CREATE TABLE "pedidos_tiny" (
    "id" TEXT NOT NULL,
    "origem" "OrigemPedidoTiny" NOT NULL,
    "chave" TEXT NOT NULL,
    "solicitacao_id" TEXT,
    "lote_id" TEXT,
    "linha" INTEGER,
    "destinatario" TEXT NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "envio" "EnvioTiny" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proxima_tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erro" TEXT,
    "tiny_id" TEXT,
    "tiny_numero" TEXT,
    "situacao" TEXT,
    "rastreio" TEXT,
    "url_rastreio" TEXT,
    "nota_fiscal_id" TEXT,
    "enviado_em" TIMESTAMP(3),
    "sincronizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_tiny_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_tiny" (
    "id" TEXT NOT NULL,
    "marcador" TEXT NOT NULL,
    "arquivo" TEXT,
    "sku" TEXT,
    "produto" TEXT NOT NULL,
    "valor_unitario" DECIMAL(12,2) NOT NULL,
    "transportadora" TEXT,
    "forma_frete" TEXT,
    "subsidiaria" TEXT,
    "departamento" TEXT,
    "criado_por_id" TEXT,
    "demanda_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_tiny_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_tiny" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_tiny_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_tiny" (
    "id" TEXT NOT NULL DEFAULT 'unica',
    "enviar_presentes" BOOLEAN NOT NULL DEFAULT true,
    "transportadora" TEXT,
    "forma_frete" TEXT,
    "marcador_presentes" TEXT NOT NULL DEFAULT 'Presente Relacionamento',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_tiny_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_tiny_chave_key" ON "pedidos_tiny"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_tiny_solicitacao_id_key" ON "pedidos_tiny"("solicitacao_id");

-- CreateIndex
CREATE INDEX "pedidos_tiny_envio_proxima_tentativa_em_idx" ON "pedidos_tiny"("envio", "proxima_tentativa_em");

-- CreateIndex
CREATE INDEX "pedidos_tiny_lote_id_idx" ON "pedidos_tiny"("lote_id");

-- CreateIndex
CREATE INDEX "pedidos_tiny_criado_em_idx" ON "pedidos_tiny"("criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_tiny_demanda_id_key" ON "lotes_tiny"("demanda_id");

-- CreateIndex
CREATE INDEX "lotes_tiny_criado_em_idx" ON "lotes_tiny"("criado_em");

-- CreateIndex
CREATE INDEX "eventos_tiny_criado_em_idx" ON "eventos_tiny"("criado_em");

-- AddForeignKey
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedidos_tiny_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedidos_tiny_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes_tiny"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_tiny" ADD CONSTRAINT "lotes_tiny_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_tiny" ADD CONSTRAINT "lotes_tiny_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demandas_logistica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tiny" ADD CONSTRAINT "eventos_tiny_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_tiny"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Regras que nenhum script pode contornar.

-- Pedido de presente aponta para a solicitação; pedido de lote, para o lote e a linha.
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_tem_origem" CHECK (
  ("origem" = 'solicitacao' AND "solicitacao_id" IS NOT NULL AND "lote_id" IS NULL)
  OR ("origem" = 'lote' AND "lote_id" IS NOT NULL AND "linha" IS NOT NULL AND "solicitacao_id" IS NULL)
);

ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_tentativas_nao_negativas" CHECK ("tentativas" >= 0);

-- Enviado é ter o pedido criado no Tiny.
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_enviado_tem_data" CHECK (
  "envio" <> 'enviado' OR "enviado_em" IS NOT NULL
);

ALTER TABLE "lotes_tiny" ADD CONSTRAINT "lote_tiny_valor_nao_negativo" CHECK ("valor_unitario" >= 0);

-- A configuração é uma linha só.
ALTER TABLE "configuracao_tiny" ADD CONSTRAINT "configuracao_tiny_unica" CHECK ("id" = 'unica');
