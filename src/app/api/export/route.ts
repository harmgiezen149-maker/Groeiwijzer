import { NextResponse } from 'next/server';
import { requireContext } from '@/lib/session';
import { toErrorResponse } from '@/lib/api';
import { agendaCsv, buildExport, logboekCsv, plantenCsv, takenCsv } from '@/lib/export';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CSV: Record<string, (data: Awaited<ReturnType<typeof buildExport>>) => string> = {
  planten: plantenCsv,
  taken: takenCsv,
  agenda: agendaCsv,
  logboek: logboekCsv,
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ctx = await requireContext(url.searchParams.get('gardenId') ?? undefined);

    const jaar = new Date().getFullYear();
    const jaren = [jaar - 1, jaar, jaar + 1];
    const data = await buildExport(ctx.garden.id, jaren);

    const onderdeel = url.searchParams.get('onderdeel');
    const naam = ctx.garden.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (onderdeel && CSV[onderdeel]) {
      return new NextResponse(CSV[onderdeel](data), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="bloeiwijzer-${naam}-${onderdeel}.csv"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="bloeiwijzer-${naam}.json"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
