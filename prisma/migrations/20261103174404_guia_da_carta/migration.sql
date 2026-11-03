-- CreateTable
CREATE TABLE "guia_carta" (
    "id" TEXT NOT NULL DEFAULT 'unica',
    "texto" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guia_carta_pkey" PRIMARY KEY ("id")
);


-- O limite é de leitura, e não de folha (LIMITE_DO_GUIA em src/lib/carta.ts). O
-- registro é um só: o id fixo impede um segundo guia por script.
ALTER TABLE "guia_carta"
  ADD CONSTRAINT "guia_carta_texto_valido" CHECK (length("texto") <= 5000),
  ADD CONSTRAINT "guia_carta_registro_unico" CHECK ("id" = 'unica');
