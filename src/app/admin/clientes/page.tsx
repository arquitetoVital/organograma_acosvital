import type { Metadata } from 'next';
import ClientesAdmin from './ClientesAdmin';

export const metadata: Metadata = {
  title: 'Clientes — Açosvital',
};

export const dynamic = 'force-dynamic';

export default function AdminClientesPage() {
  return <ClientesAdmin />;
}
