import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { env } from '../../config';
import { QueueService } from '../queue/queue.module';
import { AuthedRequest } from '../../common/http';
export const equalToken = (a: unknown, b: unknown) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.length > 0 &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(@Inject(QueueService) private readonly queue: QueueService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/api/billing/webhook') return true;
    const strict = req.path.includes('/auth/') || req.path.includes('/ai');
    const key = `rate:${req.ip}:${strict ? 'strict' : 'general'}`;
    const count = Number(
      await this.queue.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        key,
      ),
    );
    if (count > (strict ? 40 : 300))
      throw new HttpException('Too many requests. Try again in a minute.', 429);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (![env.WEB_URL, env.API_URL].includes(req.get('origin') || '')) throw new ForbiddenException('Invalid request origin');
      if (!equalToken(req.cookies?.csrf_token, req.get('x-csrf-token')))
        throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    super();
  }
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()]))
      return true;
    return super.canActivate(ctx) as Promise<boolean>;
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(ctx.switchToHttp().getRequest<AuthedRequest>().user.role))
      throw new ForbiddenException('Admin access required');
    return true;
  }
}
