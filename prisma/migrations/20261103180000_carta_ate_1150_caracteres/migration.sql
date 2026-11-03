-- A carta passa a caber em 1150 caracteres, o que vai no papel que a área usa
-- (LIMITE_DA_MENSAGEM em src/lib/carta.ts). Só a trava dos modelos muda: a
-- mensagem da solicitação não tem CHECK de tamanho.
ALTER TABLE "modelos_carta" DROP CONSTRAINT "modelo_carta_texto_valido";

ALTER TABLE "modelos_carta"
  ADD CONSTRAINT "modelo_carta_texto_valido" CHECK (
    length(btrim("texto")) > 0 AND length("texto") <= 1150
  );
