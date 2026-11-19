-- CreateEnum
CREATE TYPE "ContaTiny" AS ENUM ('consultoria', 'dns', 'supernova');

-- AlterTable
ALTER TABLE "contatos_tiny" ADD COLUMN     "conta" "ContaTiny" NOT NULL DEFAULT 'consultoria';

-- AlterTable
ALTER TABLE "lotes_tiny" ADD COLUMN     "conta" "ContaTiny" NOT NULL DEFAULT 'consultoria';

-- AlterTable
ALTER TABLE "pedidos_tiny" ADD COLUMN     "conta" "ContaTiny" NOT NULL DEFAULT 'consultoria';

-- O presente do Relacionamento vai sempre ao Tiny da Consultoria.
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_presente_na_consultoria" CHECK ("solicitacao_id" IS NULL OR "conta" = 'consultoria');
