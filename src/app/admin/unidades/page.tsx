import type { Metadata } from 'next';
import UnidadesAdmin from './UnidadesAdmin';

export const metadata: Metadata = {
  title: 'Unidades — Açosvital',
};

export const dynamic = 'force-dynamic';

export default function AdminUnidadesPage() {
  return <UnidadesAdmin />;
}
