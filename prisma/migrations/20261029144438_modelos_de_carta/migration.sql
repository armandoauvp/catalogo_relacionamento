-- CreateTable
CREATE TABLE "modelos_carta" (
    "id" TEXT NOT NULL,
    "motivo" "MotivoEnvio" NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_carta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_carta_motivo_ativo_ordem_idx" ON "modelos_carta"("motivo", "ativo", "ordem");

-- Texto de modelo é um pedaço de carta: não pode ser vazio nem passar do
-- limite da folha (LIMITE_DA_MENSAGEM em src/lib/carta.ts).
ALTER TABLE "modelos_carta"
  ADD CONSTRAINT "modelo_carta_texto_valido" CHECK (
    length(btrim("texto")) > 0 AND length("texto") <= 600
  );

-- Os modelos que estavam fixos no código: a tela abre com eles.
INSERT INTO "modelos_carta" ("id", "motivo", "texto", "ordem", "atualizado_em")
SELECT gen_random_uuid()::text, v.motivo::"MotivoEnvio", v.texto, v.ordem, CURRENT_TIMESTAMP
FROM (VALUES
  ('aniversario', 'Feliz aniversário, {nome}! Que este novo ano venha com saúde, conquistas e boas decisões. Obrigado por caminhar com a gente.', 0),
  ('aniversario', 'Parabéns, {nome}! Um brinde a mais um ano e a tudo o que você vem construindo.', 1),
  ('casamento', 'Parabéns pelo casamento, {nome}! Que a vida a dois seja tão bem planejada quanto os sonhos de vocês.', 0),
  ('casamento', 'Felicidades, {nome}! Que este novo capítulo venha cheio de planos e de realizações conjuntas.', 1),
  ('nascimento', 'Parabéns pela chegada do bebê, {nome}! Que venha muita saúde e um futuro bem preparado.', 0),
  ('nascimento', 'Seja bem-vindo ao mundo! Parabéns, {nome}, por esse novo começo.', 1),
  ('reforco_relacionamento', 'Oi, {nome}! Passando para agradecer pela confiança. Seguimos juntos e à disposição sempre que precisar.', 0),
  ('reforco_relacionamento', '{nome}, obrigado por fazer parte da nossa história. Este presente é um lembrete de que estamos por perto.', 1),
  ('primeiro_milhao', 'Parabéns pelo primeiro milhão, {nome}! É o resultado de consistência e de boas escolhas, e foi uma alegria acompanhar de perto.', 0),
  ('primeiro_milhao', '{nome}, o primeiro milhão é um marco que poucos alcançam. Que venham os próximos.', 1),
  ('outro', 'Oi, {nome}! Este presente é um jeito de dizer que a gente lembra de você.', 0)
) AS v(motivo, texto, ordem);
