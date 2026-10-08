import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { uploadSchema, User, z } from '@trackr/shared';
import { CurrentUser, Endpoint, ZodPipe } from '../../common/http';
import { DbService } from '../../db/db.service';
import { resumes } from '../../db/schema';
import { QueueService } from '../queue/queue.module';
import { StorageService } from '../storage/storage.module';
const confirmSchema = z.object({ fileKey: z.string(), fileName: z.string().min(1).max(200) });
@Injectable()
export class ResumesService {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  async upload(userId: string, body: z.infer<typeof uploadSchema>) {
    const fileKey = `${userId}/${randomUUID()}.pdf`;
    await this.queue.redis.set(
      `upload:${fileKey}`,
      JSON.stringify({ size: body.size, fileName: body.fileName }),
      'EX',
      900,
    );
    return { fileKey, url: await this.storage.uploadUrl(fileKey, body.size) };
  }
  async confirm(userId: string, body: z.infer<typeof confirmSchema>) {
    if (!body.fileKey.startsWith(`${userId}/`)) throw new BadRequestException('Invalid upload key');
    const ticket = await this.queue.redis.get(`upload:${body.fileKey}`);
    if (!ticket) throw new BadRequestException('Upload expired; please upload again');
    const expected = z.object({ size: z.number(), fileName: z.string() }).parse(JSON.parse(ticket));
    const head = await this.storage.head(body.fileKey);
    const signature = Buffer.from(await this.storage.bytes(body.fileKey, 'bytes=0-4')).toString();
    if (
      head.ContentLength !== expected.size ||
      head.ContentType !== 'application/pdf' ||
      signature !== '%PDF-'
    ) {
      await this.storage.delete(body.fileKey);
      throw new BadRequestException('File must be a PDF no larger than 5 MB');
    }
    const [resume] = await this.database.db
      .insert(resumes)
      .values({ userId, fileKey: body.fileKey, fileName: expected.fileName })
      .onConflictDoNothing()
      .returning();
    if (!resume) throw new BadRequestException('Upload already confirmed');
    await this.queue.add(
      'resume-parse',
      'parse',
      { userId, resumeId: resume.id },
      `resume-${resume.id}`,
    );
    await this.queue.redis.del(`upload:${body.fileKey}`);
    return resume;
  }
  list(userId: string) {
    return this.database.db.query.resumes.findMany({
      where: eq(resumes.userId, userId),
      columns: { embedding: false, parsedText: false, fileKey: false },
      orderBy: desc(resumes.createdAt),
    });
  }
  async delete(userId: string, id: string) {
    const resume = await this.database.db.query.resumes.findFirst({
      where: and(eq(resumes.userId, userId), eq(resumes.id, id)),
    });
    if (!resume) throw new NotFoundException('CV not found');
    await this.storage.delete(resume.fileKey);
    await this.database.db
      .delete(resumes)
      .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
    return { ok: true };
  }
}
@ApiTags('CVs')
@Controller('resumes')
export class ResumesController {
  constructor(@Inject(ResumesService) private readonly service: ResumesService) {}
  @Get() @Endpoint('List CVs and extracted skills') list(@CurrentUser() u: User) {
    return this.service.list(u.id);
  }
  @Post('upload-url') @Endpoint('Request a five-minute PDF upload URL', uploadSchema) upload(
    @CurrentUser() u: User,
    @Body(new ZodPipe(uploadSchema)) b: z.infer<typeof uploadSchema>,
  ) {
    return this.service.upload(u.id, b);
  }
  @Post() @Endpoint('Verify and enqueue a CV upload', confirmSchema) confirm(
    @CurrentUser() u: User,
    @Body(new ZodPipe(confirmSchema)) b: z.infer<typeof confirmSchema>,
  ) {
    return this.service.confirm(u.id, b);
  }
  @Delete(':id') @Endpoint('Delete a CV and its stored file') delete(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(u.id, id);
  }
}
@Module({ controllers: [ResumesController], providers: [ResumesService] })
export class ResumesModule {}
