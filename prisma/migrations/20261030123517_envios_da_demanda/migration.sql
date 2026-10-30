-- CreateTable
CREATE TABLE "envios_demanda" (
    "id" TEXT NOT NULL,
    "demanda_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "registrado_por" TEXT NOT NULL,
    "anulado_em" TIMESTAMP(3),
    "anulado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envios_demanda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_demanda_demanda_id_idx" ON "envios_demanda"("demanda_id");

-- CreateIndex
CREATE INDEX "envios_demanda_enviado_em_idx" ON "envios_demanda"("enviado_em");

-- AddForeignKey
ALTER TABLE "envios_demanda" ADD CONSTRAINT "envios_demanda_demanda_id_fkey" FOREIGN KEY ("demanda_id") REFERENCES "demandas_logistica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_demanda" ADD CONSTRAINT "envios_demanda_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_demanda" ADD CONSTRAINT "envios_demanda_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lançamento é de quantidade despachada: zero ou negativo não é envio. A
-- correção de um erro é anular o lançamento, não lançar o contrário.
ALTER TABLE "envios_demanda"
  ADD CONSTRAINT "envio_demanda_quantidade_positiva" CHECK ("quantidade" > 0);

-- Anulado tem quem anulou, e vice-versa: as duas colunas andam juntas.
ALTER TABLE "envios_demanda"
  ADD CONSTRAINT "envio_demanda_anulacao_completa" CHECK (
    ("anulado_em" IS NULL) = ("anulado_por" IS NULL)
  );
