-- CreateEnum
CREATE TYPE "SituacaoNoFornecedor" AS ENUM ('disponivel', 'limitado', 'esgotado', 'nao_conferido');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "fornecedor_conferido_em" TIMESTAMP(3),
ADD COLUMN     "fornecedor_erro" TEXT,
ADD COLUMN     "fornecedor_preco" DECIMAL(12,2),
ADD COLUMN     "fornecedor_situacao" "SituacaoNoFornecedor";
