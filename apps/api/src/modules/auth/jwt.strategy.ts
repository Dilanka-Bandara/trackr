import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { z } from '@trackr/shared';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { env } from '../../config';
import { safeUser } from './auth.service';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(DbService) private readonly database: DbService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : null,
      ]),
      secretOrKey: env.JWT_SECRET,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }
  async validate(payload: unknown) {
    const token = z.object({ sub: z.uuid() }).safeParse(payload);
    if (!token.success) throw new UnauthorizedException();
    const user = await this.database.db.query.users.findFirst({
      where: eq(users.id, token.data.sub),
    });
    if (!user) throw new UnauthorizedException();
    return safeUser(user);
  }
}
