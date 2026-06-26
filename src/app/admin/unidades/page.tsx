import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminUnidadesPage() {
  redirect('/admin/unidades/cadastro');
}
