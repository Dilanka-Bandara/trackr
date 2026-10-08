import { z } from 'zod';
export { z };
export const statuses = ['WISHLIST', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
export const statusSchema = z.enum(statuses);
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().toLowerCase(),
  password: z.string().min(8).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const jobSchema = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  url: z
    .union([z.url().refine((v) => /^https?:/.test(v), 'Use an HTTP or HTTPS URL'), z.literal('')])
    .default(''),
  location: z.string().max(160).default(''),
  salaryText: z.string().max(120).default(''),
  description: z.string().max(30000).default(''),
});
export const applicationSchema = z.object({
  jobId: z.uuid(),
  resumeId: z.uuid().nullable().optional(),
  status: statusSchema.default('WISHLIST'),
  notes: z.string().max(10000).default(''),
});
export const moveSchema = z.object({
  status: statusSchema,
  position: z.number().int().min(0).max(10000),
});
export const notesSchema = z.object({
  notes: z.string().max(10000),
  resumeId: z.uuid().nullable().optional(),
});
export const reminderSchema = z.object({
  applicationId: z.uuid(),
  remindAt: z.iso.datetime().refine((v) => Date.parse(v) > Date.now(), 'Choose a future time'),
  message: z.string().trim().min(1).max(500),
});
export const uploadSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(200)
    .refine((v) => v.toLowerCase().endsWith('.pdf')),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  contentType: z.literal('application/pdf'),
});
export const aiTaskSchema = z.object({
  type: z.enum(['MATCH', 'COVER_LETTER', 'INTERVIEW_QUESTIONS']),
  tone: z.enum(['formal', 'friendly']).default('formal'),
});
export type Status = z.infer<typeof statusSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
};
export type Job = JobInput & { id: string; createdAt: string };
export type Application = {
  id: string;
  jobId: string;
  resumeId: string | null;
  status: Status;
  position: number;
  notes: string;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job;
  score?: number | null;
};
export type Resume = {
  id: string;
  fileName: string;
  status: 'UPLOADED' | 'PARSING' | 'READY' | 'FAILED';
  createdAt: string;
  parsedJson: { skills?: string[]; experience?: string[]; education?: string[] } | null;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};
export type AiResult = {
  id: string;
  type: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  score: number | null;
  content: {
    text?: string;
    strengths?: string[];
    gaps?: string[];
    questions?: { question: string; category: string; tip: string }[];
    error?: string;
  } | null;
};
export const planLimits = { FREE: 10, PRO: 200 } as const;
