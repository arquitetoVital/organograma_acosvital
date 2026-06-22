# Migrations SQL

Cada arquivo aqui representa **uma alteração pontual** no banco, aplicada após o `schema.sql` inicial.

## Convenção de nome

```
YYYYMMDD_descricao_curta.sql
```

Exemplos:
- `20260619_adicionar_coluna_apelido.sql`
- `20260620_index_org_nodes_name.sql`
- `20260625_rls_policy_nova_regra.sql`

## Como aplicar

1. Abra o Supabase Dashboard → **SQL Editor**
2. Cole o conteúdo do arquivo e execute
3. Anote a data de execução em um comentário no topo do arquivo (opcional, mas ajuda)

## Regras

- **Nunca edite o `schema.sql`** para pequenas mudanças — crie um arquivo novo aqui
- Cada arquivo deve ser **idempotente** quando possível (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`)
- Um arquivo por assunto — não misture coisas não relacionadas
- Após aplicar, **não delete** o arquivo — ele serve de histórico
