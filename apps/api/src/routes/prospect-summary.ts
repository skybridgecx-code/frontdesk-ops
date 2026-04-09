import type { FastifyInstance } from 'fastify';
import { ProspectStatus, prisma } from '@frontdesk/db';
import { isProspectTerminalStatus } from '@frontdesk/domain';
import { businessIdParams } from '../lib/params.js';

export async function registerProspectSummaryRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId/prospects/summary', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const grouped = await prisma.prospect.groupBy({
      by: ['status'],
      where: {
        businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      _count: {
        _all: true
      }
    });

    const counts = new Map(grouped.map((row) => [row.status, row._count._all]));

    return {
      ok: true,
      summary: {
        total: grouped.reduce((sum, row) => sum + row._count._all, 0),
        active: grouped.reduce(
          (sum, row) => sum + (isProspectTerminalStatus(row.status) ? 0 : row._count._all),
          0
        ),
        terminal: grouped.reduce(
          (sum, row) => sum + (isProspectTerminalStatus(row.status) ? row._count._all : 0),
          0
        ),
        new: counts.get(ProspectStatus.NEW) ?? 0,
        ready: counts.get(ProspectStatus.READY) ?? 0,
        inProgress: counts.get(ProspectStatus.IN_PROGRESS) ?? 0,
        attempted: counts.get(ProspectStatus.ATTEMPTED) ?? 0,
        responded: counts.get(ProspectStatus.RESPONDED) ?? 0,
        qualified: counts.get(ProspectStatus.QUALIFIED) ?? 0,
        disqualified: counts.get(ProspectStatus.DISQUALIFIED) ?? 0,
        archived: counts.get(ProspectStatus.ARCHIVED) ?? 0
      }
    };
  });
}
