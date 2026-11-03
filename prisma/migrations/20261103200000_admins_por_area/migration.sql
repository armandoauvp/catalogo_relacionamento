-- Dois admins por área, ao lado do Admin geral. Só acrescenta: ninguém muda de
-- perfil com esta migration.
ALTER TYPE "Perfil" ADD VALUE 'admin_relacionamento';
ALTER TYPE "Perfil" ADD VALUE 'admin_logistica';
