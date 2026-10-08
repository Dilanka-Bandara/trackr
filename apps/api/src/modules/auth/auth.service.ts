import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { z, registerSchema, User } from '@trackr/shared';
import { DbService } from '../../db/db.service';
import { refreshTokens, users } from '../../db/schema';
import { QueueService } from '../queue/queue.module';
export const safeUser = (u: typeof users.$inferSelect): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  plan: u.plan,
});
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthService {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  async register(input: z.infer<typeof registerSchema>) {
    const passwordHash = await hash(input.password);
    const [user] = await this.database.db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .onConflictDoNothing()
      .returning();
    if (!user) throw new ConflictException('This email is already registered');
    await this.queue.add('emails', 'welcome', { userId: user.id }, `welcome-${user.id}`);
    return this.session(user);
  }
  async login(email: string, password: string) {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user?.passwordHash || !(await verify(user.passwordHash, password)))
      throw new UnauthorizedException('Email or password is incorrect');
    return this.session(user);
  }
  async session(user: typeof users.$inferSelect) {
    const refresh = randomBytes(48).toString('hex');
    await this.database.db
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: tokenHash(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
    return { user: safeUser(user), access: this.jwt.sign({ sub: user.id }), refresh };
  }
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    return this.database.db.transaction(async (tx) => {
      // Atomic revocation makes a refresh token single-use even under concurrent requests.
      const [old] = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.tokenHash, tokenHash(token)),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!old) throw new UnauthorizedException('Session expired; please sign in again');
      const user = await tx.query.users.findFirst({ where: eq(users.id, old.userId) });
      if (!user) throw new UnauthorizedException();
      const refresh = randomBytes(48).toString('hex');
      await tx
        .insert(refreshTokens)
        .values({
          userId: user.id,
          tokenHash: tokenHash(refresh),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        });
      return { user: safeUser(user), access: this.jwt.sign({ sub: user.id }), refresh };
    });
  }
  async logout(token?: string) {
    if (token)
      await this.database.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash(token)));
  }
  async google(id: string, email: string, name: string) {
    let user = await this.database.db.query.users.findFirst({ where: eq(users.googleId, id) });
    if (!user) {
      // Do not silently link an existing password account based only on matching email.
      const existing = await this.database.db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (existing) throw new BadRequestException('Sign in with your email and password');
      [user] = await this.database.db
        .insert(users)
        .values({ googleId: id, email, name })
        .returning();
    }
    if (!user) throw new UnauthorizedException();
    return this.session(user);
  }
}
