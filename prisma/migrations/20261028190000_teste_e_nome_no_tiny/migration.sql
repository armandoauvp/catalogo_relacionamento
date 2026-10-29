-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "nome_no_tiny" TEXT;

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "teste" BOOLEAN NOT NULL DEFAULT false;
