-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "saudacao_carta" TEXT;


-- Uma linha, e não um parágrafo (LIMITE_DA_SAUDACAO em src/lib/carta.ts).
ALTER TABLE "solicitacoes"
  ADD CONSTRAINT "solicitacao_saudacao_valida" CHECK (
    "saudacao_carta" IS NULL OR length("saudacao_carta") <= 80
  );
