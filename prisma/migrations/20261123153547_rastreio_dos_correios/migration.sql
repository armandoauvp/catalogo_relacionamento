-- CreateTable
CREATE TABLE "objetos_rastreados" (
    "codigo" TEXT NOT NULL,
    "entregue_em" TIMESTAMP(3),
    "consultado_em" TIMESTAMP(3),
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetos_rastreados_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "eventos_de_rastreio" (
    "id" TEXT NOT NULL,
    "codigo_objeto" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT,
    "destino" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_de_rastreio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objetos_rastreados_entregue_em_consultado_em_idx" ON "objetos_rastreados"("entregue_em", "consultado_em");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_de_rastreio_codigo_objeto_ocorrido_em_codigo_tipo_key" ON "eventos_de_rastreio"("codigo_objeto", "ocorrido_em", "codigo", "tipo");

-- AddForeignKey
ALTER TABLE "eventos_de_rastreio" ADD CONSTRAINT "eventos_de_rastreio_codigo_objeto_fkey" FOREIGN KEY ("codigo_objeto") REFERENCES "objetos_rastreados"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
