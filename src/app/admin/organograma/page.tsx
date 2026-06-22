import type { Metadata } from 'next';
import OrganogramaEditor from './OrganogramaEditor';

export const metadata: Metadata = {
  title: 'Organograma — Açosvital',
};

export const dynamic = 'force-dynamic';

export default function AdminOrganogramaPage() {
  return <OrganogramaEditor />;
}
