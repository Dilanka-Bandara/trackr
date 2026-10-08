import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, asc, eq } from 'drizzle-orm';
import { reminderSchema, User, z } from '@trackr/shared';
import { CurrentUser, Endpoint, ZodPipe } from '../../common/http';
import { DbService } from '../../db/db.service';
import { reminders } from '../../db/schema';
import { ApplicationsModule } from '../applications/applications.module';
import { ApplicationsService } from '../applications/applications.service';
@ApiTags('Reminders')
@Controller('reminders')
export class RemindersController {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(ApplicationsService) private readonly applications: ApplicationsService,
  ) {}
  @Get() @Endpoint('List follow-up reminders') list(@CurrentUser() u: User) {
    return this.database.db.query.reminders.findMany({
      where: eq(reminders.userId, u.id),
      orderBy: asc(reminders.remindAt),
    });
  }
  @Post() @Endpoint('Schedule a follow-up', reminderSchema) async create(
    @CurrentUser() u: User,
    @Body(new ZodPipe(reminderSchema)) body: z.infer<typeof reminderSchema>,
  ) {
    await this.applications.get(u.id, body.applicationId);
    const [result] = await this.database.db
      .insert(reminders)
      .values({ ...body, userId: u.id, remindAt: new Date(body.remindAt) })
      .returning();
    return result;
  }
  @Delete(':id') @Endpoint('Cancel a reminder') async delete(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.database.db
      .delete(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, u.id)));
    return { ok: true };
  }
}
@Module({ imports: [ApplicationsModule], controllers: [RemindersController] })
export class RemindersModule {}
