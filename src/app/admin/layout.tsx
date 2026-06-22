import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEV_AUTH_BYPASS } from '@/lib/devAuth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Em desenvolvimento com bypass ativo, libera o acesso sem checar a role.
  if (!DEV_AUTH_BYPASS) {
    try {
      const supabase = await createClient();
      const { data: role } = await supabase.rpc('get_my_role');

      // Somente admin e editor podem acessar o painel
      if (role !== 'admin' && role !== 'editor') {
        redirect('/?erro=acesso-negado');
      }
    } catch {
      redirect('/?erro=acesso-negado');
    }
  }

  return <>{children}</>;
}
