import { Controller, Get, Inject, Module, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { WebSocketGateway, OnGatewayConnection, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { and, desc, eq } from 'drizzle-orm';
import { User, z } from '@trackr/shared';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Endpoint } from '../../common/http';
import { DbService } from '../../db/db.service';
import { notifications } from '../../db/schema';
import { env } from '../../config';
import { QueueService } from '../queue/queue.module';
@WebSocketGateway({ cors: { origin: env.WEB_URL, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private subscriber?: ReturnType<QueueService['redis']['duplicate']>;
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  afterInit(server: Server) {
    this.subscriber = this.queue.redis.duplicate();
    server.adapter(createAdapter(this.queue.redis, this.subscriber));
  }
  async onModuleDestroy() {
    await this.subscriber?.quit();
  }
  async handleConnection(client: Socket) {
    try {
      if (client.handshake.headers.origin !== env.WEB_URL) throw new Error('Origin');
      const cookie = client.handshake.headers.cookie
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('access_token='))
        ?.slice(13);
      const token = z
        .object({ sub: z.uuid(), exp: z.number() })
        .parse(this.jwt.verify(cookie || ''));
      await client.join(`user:${token.sub}`);
      const timer = setTimeout(
        () => client.disconnect(true),
        Math.max(0, token.exp * 1000 - Date.now()),
      );
      client.once('disconnect', () => clearTimeout(timer));
    } catch {
      client.disconnect(true);
    }
  }
}
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(DbService) private readonly database: DbService) {}
  @Get() @Endpoint('Get recent notifications') list(@CurrentUser() u: User) {
    return this.database.db.query.notifications.findMany({
      where: eq(notifications.userId, u.id),
      orderBy: desc(notifications.createdAt),
      limit: 50,
    });
  }
  @Patch(':id/read') @Endpoint('Mark a notification read') async read(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, u.id)));
    return { ok: true };
  }
}
@Module({ controllers: [NotificationsController], providers: [NotificationsGateway] })
export class NotificationsModule {}
