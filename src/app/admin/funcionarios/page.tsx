import type { Metadata } from 'next';
import FuncionariosAdmin from './FuncionariosAdmin';

export const metadata: Metadata = { title: 'Funcionários — Açosvital' };
export const dynamic = 'force-dynamic';

export default function AdminFuncionariosPage() {
  return <FuncionariosAdmin />;
}
