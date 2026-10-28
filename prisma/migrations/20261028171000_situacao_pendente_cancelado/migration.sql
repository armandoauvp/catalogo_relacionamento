-- A solicitação cancelada aqui cancela o pedido no Tiny, pela fila, além dos
-- dois passos da expedição.
ALTER TABLE "pedidos_tiny" DROP CONSTRAINT "pedido_tiny_situacao_pendente_valida";
ALTER TABLE "pedidos_tiny" ADD CONSTRAINT "pedido_tiny_situacao_pendente_valida" CHECK (
  "situacao_pendente" IS NULL OR "situacao_pendente" IN ('preparando_envio', 'pronto_envio', 'cancelado')
);
