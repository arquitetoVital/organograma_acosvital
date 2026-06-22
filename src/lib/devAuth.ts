/**
 * Bypass de autenticação para DESENVOLVIMENTO.
 *
 * Quando `DEV_AUTH_BYPASS=true` no `.env.local` **e** o ambiente não é de
 * produção, o `proxy.ts` libera o acesso às rotas protegidas e o layout assume
 * o papel de administrador. Isso permite inspecionar e validar as telas internas
 * (organograma, globos, painel admin) sem uma sessão real do Supabase.
 *
 * A checagem dupla é proposital: mesmo que a variável vaze para o ambiente de
 * produção por engano, `process.env.NODE_ENV === 'production'` garante que o
 * bypass **nunca** terá efeito em produção.
 *
 * Para desativar: remova ou defina `DEV_AUTH_BYPASS=false` no `.env.local`.
 */
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_AUTH_BYPASS === 'true';
