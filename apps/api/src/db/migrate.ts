import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DbService } from './db.service';
async function main() {
  const db = new DbService();
  try {
    await migrate(db.db, { migrationsFolder: './drizzle' });
  } finally {
    await db.onModuleDestroy();
  }
}
void main();
