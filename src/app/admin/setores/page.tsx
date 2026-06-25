import type { Metadata } from 'next';
import SetoresAdmin from './SetoresAdmin';

export const metadata: Metadata = { title: 'Setores — Açosvital' };
export const dynamic = 'force-dynamic';

export default function AdminSetoresPage() {
  return <SetoresAdmin />;
}
