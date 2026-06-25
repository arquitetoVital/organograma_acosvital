import { NextResponse } from 'next/server';
import { apiGet, extractArray } from '@/lib/apiClient';

export const dynamic = 'force-dynamic';

interface ApiPage {
  unidades?: unknown[];
  total?:    number;
  page?:     number;
  pages?:    number;
  [k: string]: unknown;
}

const LIMIT = 100;

export async function GET() {
  let firstPage: ApiPage;
  try {
    firstPage = await apiGet<ApiPage>('/unidades', { page: '1', limit: String(LIMIT) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao buscar unidades.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const totalPages = Number(firstPage.pages ?? 1);
  let all = extractArray(firstPage, 'unidades');

  if (totalPages > 1) {
    const pages = await Promise.allSettled(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        apiGet<ApiPage>('/unidades', { page: String(i + 2), limit: String(LIMIT) })
          .then(r => extractArray(r, 'unidades')),
      ),
    );
    for (const r of pages) {
      if (r.status === 'fulfilled') all = [...all, ...r.value];
    }
  }

  return NextResponse.json({
    unidades: all,
    total:    Number(firstPage.total ?? all.length),
  });
}
