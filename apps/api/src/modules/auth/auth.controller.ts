import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { z, loginSchema, registerSchema, User } from '@trackr/shared';
import { CurrentUser, Endpoint, Public, ZodPipe } from '../../common/http';
import { env } from '../../config';
import { AuthService } from './auth.service';
import { equalToken } from './guards';
const cookies = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private setSession(res: Response, session: Awaited<ReturnType<AuthService['session']>>) {
    res.cookie('access_token', session.access, { ...cookies, maxAge: 15 * 60000 });
    res.cookie('refresh_token', session.refresh, { ...cookies, maxAge: 7 * 86400000 });
    return session.user;
  }
  @Public() @Get('csrf') @Endpoint('Issue a double-submit CSRF token') csrf(
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = randomBytes(32).toString('hex');
    res.cookie('csrf_token', token, { ...cookies, httpOnly: false });
    return { token };
  }
  @Public() @Post('register') @Endpoint('Create an account', registerSchema) async register(
    @Body(new ZodPipe(registerSchema)) input: z.infer<typeof registerSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(res, await this.auth.register(input));
  }
  @Public() @Post('login') @Endpoint('Sign in', loginSchema) async login(
    @Body(new ZodPipe(loginSchema)) input: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(res, await this.auth.login(input.email, input.password));
  }
  @Public() @Post('refresh') @Endpoint('Rotate refresh and access tokens') async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setSession(res, await this.auth.refresh(req.cookies?.refresh_token));
  }
  @Public() @Post('logout') @Endpoint('Revoke session') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.refresh_token);
    res.clearCookie('access_token', cookies);
    res.clearCookie('refresh_token', cookies);
    return { ok: true };
  }
  @Get('me') @Endpoint('Get signed-in user') me(@CurrentUser() user: User) {
    return user;
  }
  @Public() @Get('google') @Endpoint('Start Google OAuth') google(@Res() res: Response) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
      throw new ServiceUnavailableException('Google sign-in is not configured');
    const state = randomBytes(32).toString('hex');
    res.cookie('oauth_state', state, { ...cookies, maxAge: 600000 });
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.API_URL}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }
  @Public() @Get('google/callback') @Endpoint('Complete Google OAuth') async callback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (
      !equalToken(req.cookies?.oauth_state, req.query.state) ||
      typeof req.query.code !== 'string'
    )
      throw new UnauthorizedException('Invalid OAuth state');
    res.clearCookie('oauth_state', cookies);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: req.query.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.API_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) throw new UnauthorizedException('Google sign-in failed');
    const token = z.object({ access_token: z.string() }).parse(await tokenResponse.json());
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    const profile = z
      .object({
        sub: z.string(),
        email: z.email(),
        name: z.string(),
        email_verified: z.literal(true),
      })
      .parse(await info.json());
    this.setSession(
      res,
      await this.auth.google(profile.sub, profile.email.toLowerCase(), profile.name),
    );
    res.redirect(`${env.WEB_URL}/app`);
  }
}
