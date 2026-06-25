import { createClient } from '@/lib/supabase/server';
import { DEV_AUTH_BYPASS } from '@/lib/devAuth';
import ClientesView from './ClientesView';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  let canViewDetails = DEV_AUTH_BYPASS;
  if (!DEV_AUTH_BYPASS) {
    try {
      const supabase = await createClient();
      const { data: role } = await supabase.rpc('get_my_role');
      canViewDetails = role === 'admin' || role === 'editor';
    } catch {}
  }

  return <ClientesView canViewDetails={canViewDetails} />;
}
