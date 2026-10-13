-- O valor novo do enum fica numa migration só dele: o Postgres não deixa usar
-- um valor de enum na mesma transação em que ele foi criado, e a migration
-- seguinte o põe como padrão da coluna.
ALTER TYPE "OrigemDemanda" ADD VALUE 'manual';
