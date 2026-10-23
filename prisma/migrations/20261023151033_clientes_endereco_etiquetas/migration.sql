-- AlterEnum
ALTER TYPE "OrigemCliente" ADD VALUE 'site';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "uf" CHAR(2);

-- CreateIndex
CREATE INDEX "clientes_etiquetas_idx" ON "clientes" USING GIN ("etiquetas");

-- CreateIndex
CREATE INDEX "clientes_criado_em_idx" ON "clientes"("criado_em");

-- UF do endereço padrão, quando preenchida, é uma sigla de duas letras.
ALTER TABLE "clientes" ADD CONSTRAINT "cliente_uf_valida" CHECK ("uf" IS NULL OR "uf" ~ '^[A-Z]{2}$');
-- CEP padrão só com os dígitos.
ALTER TABLE "clientes" ADD CONSTRAINT "cliente_cep_valido" CHECK ("cep" IS NULL OR "cep" ~ '^[0-9]{8}$');
