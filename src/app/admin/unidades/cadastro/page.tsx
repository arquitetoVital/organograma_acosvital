import type { Metadata } from 'next';
import UnidadesCadastroAdmin from './UnidadesCadastroAdmin';

export const metadata: Metadata = { title: 'Unidades — Açosvital' };
export const dynamic = 'force-dynamic';

export default function AdminUnidadesCadastroPage() {
  return <UnidadesCadastroAdmin />;
}
