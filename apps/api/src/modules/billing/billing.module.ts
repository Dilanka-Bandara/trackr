import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { planLimits, User } from '@trackr/shared';
import { CurrentUser, Endpoint, Public } from '../../common/http';
import { DbService } from '../../db/db.service';
import { stripeEvents, subscriptions, usage, users } from '../../db/schema';
import { env } from '../../config';
@Injectable()
export class BillingService {
  constructor(@Inject(DbService) private readonly database: DbService) {}
  client() {
    if (!env.STRIPE_SECRET_KEY)
      throw new ServiceUnavailableException(
        'Billing is not configured. Set Stripe test-mode credentials.',
      );
    return new Stripe(env.STRIPE_SECRET_KEY);
  }
  async checkout(user: User) {
    if (!env.STRIPE_PRICE_ID)
      throw new ServiceUnavailableException('Stripe price is not configured');
    const stripe = this.client();
    let subscription = await this.database.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });
    if (!subscription) {
      const customer = await stripe.customers.create(
        { email: user.email, name: user.name, metadata: { userId: user.id } },
        { idempotencyKey: `customer-${user.id}` },
      );
      [subscription] = await this.database.db
        .insert(subscriptions)
        .values({ userId: user.id, stripeCustomerId: customer.id, status: 'incomplete' })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeCustomerId: customer.id },
        })
        .returning();
    }
    if (['active', 'trialing'].includes(subscription!.status)) return this.portal(user.id);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: subscription!.stripeCustomerId,
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id } },
      success_url: `${env.WEB_URL}/app/settings/billing?success=1`,
      cancel_url: `${env.WEB_URL}/app/settings/billing`,
    });
    return { url: session.url };
  }
  async portal(userId: string) {
    const subscription = await this.database.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    if (!subscription) throw new BadRequestException('No billing account yet');
    return this.client().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env.WEB_URL}/app/settings/billing`,
    });
  }
  async status(user: User) {
    const current = await this.database.db.query.usage.findFirst({
      where: and(eq(usage.userId, user.id), eq(usage.month, new Date().toISOString().slice(0, 7))),
    });
    return {
      plan: user.plan,
      used: current?.aiCalls ?? 0,
      limit: planLimits[user.plan],
      configured: !!env.STRIPE_PRICE_ID && !!env.STRIPE_SECRET_KEY,
    };
  }
  async webhook(raw: Buffer, signature: string) {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new ServiceUnavailableException('Webhook not configured');
    const stripe = this.client();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
    const accepted = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];
    if (!accepted.includes(event.type)) return { received: true };
    const object = event.data.object;
    const customer =
      'customer' in object
        ? typeof object.customer === 'string'
          ? object.customer
          : object.customer?.id
        : undefined;
    if (!customer) return { received: true };
    await this.database.db.transaction(async (tx) => {
      const record = await tx.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeCustomerId, customer),
      });
      if (!record) throw new BadRequestException('Unknown Stripe customer');
      // Serialize per customer and retrieve Stripe's latest state; old webhook deliveries cannot downgrade a new subscription.
      await tx.select().from(users).where(eq(users.id, record.userId)).for('update');
      const [claimed] = await tx
        .insert(stripeEvents)
        .values({ stripeEventId: event.id })
        .onConflictDoNothing()
        .returning();
      if (!claimed) return;
      const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
      const active = list.data.find((s) => ['active', 'trialing'].includes(s.status));
      const latest = active ?? list.data.sort((a, b) => b.created - a.created)[0];
      await tx
        .update(subscriptions)
        .set({
          stripeSubscriptionId: latest?.id ?? null,
          status: latest?.status ?? 'canceled',
          currentPeriodEnd: latest?.items.data[0]?.current_period_end
            ? new Date(latest.items.data[0].current_period_end * 1000)
            : null,
        })
        .where(eq(subscriptions.userId, record.userId));
      await tx
        .update(users)
        .set({ plan: active ? 'PRO' : 'FREE' })
        .where(eq(users.id, record.userId));
    });
    return { received: true };
  }
}
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly service: BillingService) {}
  @Get() @Endpoint('Get plan and monthly usage') status(@CurrentUser() u: User) {
    return this.service.status(u);
  }
  @Post('checkout') @Endpoint('Create a Stripe subscription checkout') checkout(
    @CurrentUser() u: User,
  ) {
    return this.service.checkout(u);
  }
  @Post('portal') @Endpoint('Open the Stripe customer portal') portal(@CurrentUser() u: User) {
    return this.service.portal(u.id);
  }
  @Public() @Post('webhook') @Endpoint('Handle a signed, idempotent Stripe webhook') webhook(
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!req.rawBody) throw new BadRequestException('Raw body is required');
    return this.service.webhook(req.rawBody, req.get('stripe-signature') || '');
  }
}
@Module({ controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
