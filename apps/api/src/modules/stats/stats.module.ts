import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { statuses, User } from '@trackr/shared';
import { CurrentUser, Endpoint } from '../../common/http';
import { DbService } from '../../db/db.service';
import { applications } from '../../db/schema';
export function summarize(rows: { status: string; appliedAt: Date | null }[], now = new Date()) {
  const counts = Object.fromEntries(
    statuses.map((s) => [s, rows.filter((r) => r.status === s).length]),
  );
  const sent = rows.filter((r) => r.status !== 'WISHLIST').length;
  const responseRate = sent
    ? Math.round(
        (100 * rows.filter((r) => ['INTERVIEW', 'OFFER', 'REJECTED'].includes(r.status)).length) /
          sent,
      )
    : 0;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday.getTime() - (7 - i) * 7 * 86400000);
    return {
      week: start.toISOString().slice(0, 10),
      applications: rows.filter(
        (r) =>
          r.appliedAt &&
          r.appliedAt >= start &&
          r.appliedAt.getTime() < start.getTime() + 7 * 86400000,
      ).length,
    };
  });
  return { total: rows.length, counts, responseRate, weeks };
}
@ApiTags('Dashboard')
@Controller('stats')
export class StatsController {
  constructor(@Inject(DbService) private readonly database: DbService) {}
  @Get('me') @Endpoint('Get status counts, response rate, and eight weeks of activity') async get(
    @CurrentUser() u: User,
  ) {
    return summarize(
      await this.database.db
        .select({ status: applications.status, appliedAt: applications.appliedAt })
        .from(applications)
        .where(eq(applications.userId, u.id)),
    );
  }
}
@Module({ controllers: [StatsController] })
export class StatsModule {}
