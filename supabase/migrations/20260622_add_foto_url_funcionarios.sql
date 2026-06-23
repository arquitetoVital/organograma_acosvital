-- Adiciona coluna foto_url na tabela funcionarios
ALTER TABLE organograma.funcionarios
  ADD COLUMN IF NOT EXISTS foto_url text;
