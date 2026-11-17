-- Demanda pedida pela tela "Pedir à Logística" sempre sabe quem pediu: é por
-- esse campo que a pessoa acompanha os próprios pedidos.
-- Comparado como texto: o valor 'pedido' nasceu na migration anterior, e o
-- Postgres recusa usar valor novo de enum como enum na mesma leva de deploy.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "demanda_pedida_tem_solicitante" CHECK (
    "origem"::text <> 'pedido' OR "solicitante_id" IS NOT NULL
  );
