import type { Metadata } from 'next';
import CargosAdmin from './CargosAdmin';

export const metadata: Metadata = { title: 'Cargos — Açosvital' };
export const dynamic = 'force-dynamic';

export default function AdminCargosPage() {
  return <CargosAdmin />;
}
