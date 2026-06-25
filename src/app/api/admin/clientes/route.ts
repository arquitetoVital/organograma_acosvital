import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiGet, handleApiError, extractArray } from '@/lib/apiClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { err } = await requireAuth('editor');
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const q     = searchParams.get('q')?.trim() ?? '';
  const page  = searchParams.get('page')      ?? '1';
  const limit = searchParams.get('limit')     ?? '50';

  try {
    const raw = await apiGet<Record<string, unknown>>('/todos_os_clientes', { q, page, limit });

    const clientes = extractArray(raw, 'clientes');
    const meta     = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

    return NextResponse.json({
      clientes,
      total: Number(meta.total ?? clientes.length),
      page:  Number(meta.page  ?? page),
      pages: Number(meta.totalPages ?? meta.pages ?? 1),
    });
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao buscar clientes.');
    return NextResponse.json({ error: msg }, { status });
  }
}
