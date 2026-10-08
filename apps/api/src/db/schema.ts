import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';
const timestamps = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export const role = pgEnum('role', ['USER', 'ADMIN']);
export const plan = pgEnum('plan', ['FREE', 'PRO']);
export const applicationStatus = pgEnum('application_status', [
  'WISHLIST',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
]);
export const resumeStatus = pgEnum('resume_status', ['UPLOADED', 'PARSING', 'READY', 'FAILED']);
export const aiType = pgEnum('ai_type', ['MATCH', 'COVER_LETTER', 'INTERVIEW_QUESTIONS']);
export const resultStatus = pgEnum('result_status', ['PENDING', 'DONE', 'FAILED']);
const dim = Number(process.env.EMBEDDING_DIM || 1024);
export const users = pgTable('users', {
  ...timestamps(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: role('role').default('USER').notNull(),
  googleId: text('google_id').unique(),
  plan: plan('plan').default('FREE').notNull(),
});
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').unique().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('refresh_user_idx').on(t.userId)],
);
export const resumes = pgTable(
  'resumes',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    fileKey: text('file_key').unique().notNull(),
    fileName: text('file_name').notNull(),
    status: resumeStatus('status').default('UPLOADED').notNull(),
    parsedText: text('parsed_text'),
    parsedJson: jsonb('parsed_json').$type<{
      skills: string[];
      experience: string[];
      education: string[];
    }>(),
    embedding: vector('embedding', { dimensions: dim }),
  },
  (t) => [index('resume_user_idx').on(t.userId)],
);
export const jobs = pgTable(
  'jobs',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    company: text('company').notNull(),
    title: text('title').notNull(),
    url: text('url').default('').notNull(),
    location: text('location').default('').notNull(),
    salaryText: text('salary_text').default('').notNull(),
    description: text('description').default('').notNull(),
    embedding: vector('embedding', { dimensions: dim }),
  },
  (t) => [index('job_user_idx').on(t.userId)],
);
export const applications = pgTable(
  'applications',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: uuid('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    status: applicationStatus('status').default('WISHLIST').notNull(),
    position: integer('position').default(0).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    notes: text('notes').default('').notNull(),
  },
  (t) => [
    uniqueIndex('application_user_job_unique').on(t.userId, t.jobId),
    index('application_board_idx').on(t.userId, t.status, t.position),
    index('application_job_idx').on(t.jobId),
    index('application_resume_idx').on(t.resumeId),
  ],
);
export const aiResults = pgTable(
  'ai_results',
  {
    ...timestamps(),
    applicationId: uuid('application_id')
      .references(() => applications.id, { onDelete: 'cascade' })
      .notNull(),
    type: aiType('type').notNull(),
    status: resultStatus('status').default('PENDING').notNull(),
    score: integer('score'),
    content: jsonb('content').$type<Record<string, unknown>>(),
  },
  (t) => [index('ai_application_idx').on(t.applicationId)],
);
export const reminders = pgTable(
  'reminders',
  {
    ...timestamps(),
    applicationId: uuid('application_id')
      .references(() => applications.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    message: text('message').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('reminder_user_idx').on(t.userId),
    index('reminder_application_idx').on(t.applicationId),
    index('reminder_due_idx').on(t.remindAt),
  ],
);
export const notifications = pgTable(
  'notifications',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    eventKey: text('event_key').unique(),
  },
  (t) => [index('notification_user_idx').on(t.userId)],
);
export const subscriptions = pgTable('subscriptions', {
  ...timestamps(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  stripeCustomerId: text('stripe_customer_id').unique().notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  status: text('status').notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
});
export const usage = pgTable(
  'usage',
  {
    ...timestamps(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    month: text('month').notNull(),
    aiCalls: integer('ai_calls').default(0).notNull(),
  },
  (t) => [uniqueIndex('usage_user_month_idx').on(t.userId, t.month)],
);
export const stripeEvents = pgTable('stripe_events', {
  ...timestamps(),
  stripeEventId: text('stripe_event_id').unique().notNull(),
});
