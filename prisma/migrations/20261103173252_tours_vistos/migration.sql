-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tours_vistos" TEXT[] DEFAULT ARRAY[]::TEXT[];
