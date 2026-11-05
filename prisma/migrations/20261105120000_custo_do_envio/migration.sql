-- Custo opcional em cada envio lançado. Nulo não é zero: é "não informado".
ALTER TABLE "envios_demanda" ADD COLUMN "custo" DECIMAL(12,2);
ALTER TABLE "envios_demanda" ADD CONSTRAINT "envio_custo_nao_negativo" CHECK ("custo" IS NULL OR "custo" >= 0);
