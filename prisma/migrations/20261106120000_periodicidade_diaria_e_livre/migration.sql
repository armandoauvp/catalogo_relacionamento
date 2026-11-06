-- Valores novos de enum ficam numa migration só deles: o Postgres não deixa
-- usá-los na mesma transação em que foram criados, e a próxima migration usa.
ALTER TYPE "Periodicidade" ADD VALUE 'diaria';
ALTER TYPE "Periodicidade" ADD VALUE 'personalizada';
