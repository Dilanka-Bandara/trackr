import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { applicationSchema, moveSchema, notesSchema, User, z } from '@trackr/shared';
import { CurrentUser, Endpoint, ZodPipe } from '../../common/http';
import { ApplicationsService } from './applications.service';
@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(@Inject(ApplicationsService) private readonly service: ApplicationsService) {}
  @Get() @Endpoint('List your application board') list(@CurrentUser() u: User) {
    return this.service.list(u.id);
  }
  @Post() @Endpoint('Add an application', applicationSchema) create(
    @CurrentUser() u: User,
    @Body(new ZodPipe(applicationSchema)) body: z.infer<typeof applicationSchema>,
  ) {
    return this.service.create(u.id, body);
  }
  @Patch(':id') @Endpoint('Save notes or choose a CV', notesSchema) update(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(notesSchema)) body: z.infer<typeof notesSchema>,
  ) {
    return this.service.update(u.id, id, body);
  }
  @Patch(':id/move') @Endpoint('Move and reorder a card atomically', moveSchema) move(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(moveSchema)) body: z.infer<typeof moveSchema>,
  ) {
    return this.service.move(u.id, id, body);
  }
  @Delete(':id') @Endpoint('Delete an application') delete(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(u.id, id);
  }
}
@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
