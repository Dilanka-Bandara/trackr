import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config';
import * as schema from './schema';
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  readonly db = drizzle(this.pool, { schema });
  async onModuleDestroy() {
    await this.pool.end();
  }
}
@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}
