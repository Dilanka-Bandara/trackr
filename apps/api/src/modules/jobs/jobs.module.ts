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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { jobSchema, JobInput, User, z } from '@trackr/shared';
import { CurrentUser, Endpoint, ZodPipe } from '../../common/http';
import { JobsService } from './jobs.service';
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().max(160).default(''),
  sort: z.enum(['newest', 'company']).default('newest'),
});
@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  @Get() @Endpoint('Search and paginate your jobs') list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(querySchema)) q: z.infer<typeof querySchema>,
  ) {
    return this.jobs.list(user.id, q.page, q.search, q.sort);
  }
  @Get(':id') @Endpoint('Get a saved job') get(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.get(u.id, id);
  }
  @Post() @Endpoint('Save a job', jobSchema) create(
    @CurrentUser() u: User,
    @Body(new ZodPipe(jobSchema)) body: JobInput,
  ) {
    return this.jobs.create(u.id, body);
  }
  @Patch(':id') @Endpoint('Edit a job', jobSchema) update(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(jobSchema)) body: JobInput,
  ) {
    return this.jobs.update(u.id, id, body);
  }
  @Delete(':id') @Endpoint('Delete a job and its application') delete(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.delete(u.id, id);
  }
}
@Module({ controllers: [JobsController], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
