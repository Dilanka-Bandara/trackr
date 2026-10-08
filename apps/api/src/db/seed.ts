import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Status } from '@trackr/shared';
import { env } from '../config';
import { DbService } from './db.service';
import { applications, jobs, notifications, reminders, users } from './schema';
async function main() {
  if (env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const database = new DbService();
  const db = database.db;
  try {
    const passwordHash = await hash('Demo1234!');
    const [demo] = await db
      .insert(users)
      .values({ email: 'demo@trackr.dev', name: 'Alex Morgan', passwordHash })
      .onConflictDoUpdate({ target: users.email, set: { passwordHash } })
      .returning();
    if (!demo) throw new Error('Seed user missing');
    if (env.SEED_ADMIN_PASSWORD)
      await db
        .insert(users)
        .values({
          email: env.SEED_ADMIN_EMAIL,
          name: 'Trackr Admin',
          role: 'ADMIN',
          passwordHash: await hash(env.SEED_ADMIN_PASSWORD),
        })
        .onConflictDoNothing();
    else console.log('Admin not seeded: set SEED_ADMIN_PASSWORD (12+ characters) to create one.');
    const existing = await db.query.jobs.findFirst({ where: eq(jobs.userId, demo.id) });
    if (!existing) {
      const examples: {
        company: string;
        title: string;
        location: string;
        salaryText: string;
        status: Status;
        days: number;
      }[] = [
        {
          company: 'Linear',
          title: 'Product Designer',
          location: 'Remote',
          salaryText: '$140k – $180k',
          status: 'INTERVIEW',
          days: 2,
        },
        {
          company: 'Notion',
          title: 'Frontend Engineer',
          location: 'San Francisco, CA',
          salaryText: '$150k – $190k',
          status: 'APPLIED',
          days: 5,
        },
        {
          company: 'Figma',
          title: 'Design Engineer',
          location: 'New York, NY',
          salaryText: '$160k – $200k',
          status: 'WISHLIST',
          days: 0,
        },
        {
          company: 'Stripe',
          title: 'Software Engineer',
          location: 'Remote',
          salaryText: '$150k – $210k',
          status: 'OFFER',
          days: 20,
        },
        {
          company: 'Vercel',
          title: 'Developer Experience Engineer',
          location: 'Remote',
          salaryText: '$130k – $180k',
          status: 'APPLIED',
          days: 12,
        },
        {
          company: 'Airbnb',
          title: 'Senior Product Designer',
          location: 'San Francisco, CA',
          salaryText: '$155k – $195k',
          status: 'REJECTED',
          days: 35,
        },
      ];
      for (const [i, example] of examples.entries()) {
        const date = new Date(Date.now() - example.days * 86400000);
        const [job] = await db
          .insert(jobs)
          .values({
            userId: demo.id,
            company: example.company,
            title: example.title,
            location: example.location,
            salaryText: example.salaryText,
            description: `Illustrative demo opportunity — not an actual job listing.\n\nJoin a collaborative product team building thoughtful software. Work across design and engineering to deliver accessible, polished experiences.\n\nWhat you bring:\n• Experience with React, TypeScript, and modern web applications\n• A strong eye for usability and attention to detail\n• Clear communication and collaborative problem solving\n• Comfort working with APIs, testing, and iterative delivery`,
            createdAt: date,
            updatedAt: date,
          })
          .returning();
        await db
          .insert(applications)
          .values({
            id: randomUUID(),
            userId: demo.id,
            jobId: job!.id,
            status: example.status,
            position: i,
            notes:
              i === 0
                ? 'Prepare examples of design systems and cross-functional collaboration. Ask about the product team’s workflow.'
                : '',
            appliedAt: example.status !== 'WISHLIST' ? date : null,
            createdAt: date,
            updatedAt: date,
          });
      }
      const first = await db.query.applications.findFirst({
        where: eq(applications.userId, demo.id),
      });
      await db
        .insert(reminders)
        .values({
          userId: demo.id,
          applicationId: first!.id,
          remindAt: new Date(Date.now() + 2 * 86400000),
          message: 'Follow up with the Linear team',
        });
      await db
        .insert(notifications)
        .values({
          userId: demo.id,
          type: 'WELCOME',
          title: 'Welcome to your workspace',
          body: 'These six opportunities are sample data. Save a real job and upload your CV to make this space yours.',
          eventKey: `welcome-seed-${demo.id}`,
        });
    }
    console.log('Demo ready: demo@trackr.dev / Demo1234!');
  } finally {
    await database.onModuleDestroy();
  }
}
void main();
