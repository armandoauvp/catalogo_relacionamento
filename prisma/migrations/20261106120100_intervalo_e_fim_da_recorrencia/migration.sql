-- Intervalo livre em dias e data em que a série recorrente termina.
ALTER TABLE "demandas_logistica" ADD COLUMN "intervalo_dias" INTEGER,
ADD COLUMN "recorrente_ate" TIMESTAMP(3);

-- O intervalo existe só na periodicidade livre, e sempre nela, entre 1 e 365 dias.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "intervalo_so_na_periodicidade_livre" CHECK (
    ("periodicidade" = 'personalizada' AND "intervalo_dias" BETWEEN 1 AND 365)
    OR ("periodicidade" IS DISTINCT FROM 'personalizada' AND "intervalo_dias" IS NULL)
  );

-- Só a recorrente tem fim de série.
ALTER TABLE "demandas_logistica"
  ADD CONSTRAINT "fim_da_serie_so_na_recorrente" CHECK ("recorrente_ate" IS NULL OR "recorrente");
