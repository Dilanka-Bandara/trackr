import { Controller, Get, Inject, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from '@trackr/shared';
import { Endpoint, Roles, ZodPipe } from '../../common/http';
import { DbService } from '../../db/db.service';
import { subscriptions, usage, users } from '../../db/schema';
import { env } from '../../config';
import Stripe from 'stripe';
const schema = z.object({
  search: z.string().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
});
@ApiTags('Admin')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(@Inject(DbService) private readonly database: DbService) {}
  @Get('users') @Endpoint('Search users (admin only)') async list(
    @Query(new ZodPipe(schema)) q: z.infer<typeof schema>,
  ) {
    const where = q.search
      ? or(ilike(users.email, `%${q.search}%`), ilike(users.name, `%${q.search}%`))
      : undefined;
    const items = await this.database.db.query.users.findMany({
      where,
      columns: { passwordHash: false, googleId: false },
      orderBy: desc(users.createdAt),
      limit: 25,
      offset: (q.page - 1) * 25,
    });
    const [totals] = await this.database.db.select({ total: count() }).from(users).where(where);
    return { items, total: totals?.total ?? 0 };
  }
  @Get('stats') @Endpoint('Get user, usage, signup, and recurring revenue totals') async stats() {
    const accounts = await this.database.db
      .select({ plan: users.plan, createdAt: users.createdAt })
      .from(users);
    const calls = await this.database.db.query.usage.findMany({
      where: eq(usage.month, new Date().toISOString().slice(0, 7)),
    });
    const active = await this.database.db.query.subscriptions.findMany({
      where: eq(subscriptions.status, 'active'),
    });
    const signups = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (7 - i) * 7);
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      return {
        week: start.toISOString().slice(0, 10),
        count: accounts.filter(
          (u) => u.createdAt >= start && u.createdAt.getTime() < start.getTime() + 7 * 86400000,
        ).length,
      };
    });
    let mrr: number | null = null;
    let currency = 'usd';
    if (env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID) {
      const price = await new Stripe(env.STRIPE_SECRET_KEY).prices.retrieve(env.STRIPE_PRICE_ID);
      currency = price.currency;
      mrr =
        (active.length * (price.unit_amount ?? 0)) /
        100 /
        (price.recurring?.interval === 'year' ? 12 : 1);
    }
    return {
      users: accounts.length,
      proUsers: accounts.filter((a) => a.plan === 'PRO').length,
      aiCalls: calls.reduce((n, u) => n + u.aiCalls, 0),
      mrr,
      currency,
      signups,
    };
  }
}
@Module({ controllers: [AdminController] })
export class AdminModule {}
