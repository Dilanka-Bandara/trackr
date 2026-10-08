'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Application, User, Resume, Notification, Status } from '@trackr/shared';
import { api, json } from '@/lib/api';
import { toast } from 'sonner';
export const useUser = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
export const useApplications = () =>
  useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') });
export const useResumes = () =>
  useQuery({ queryKey: ['resumes'], queryFn: () => api<Resume[]>('/resumes') });
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api<Notification[]>('/notifications') });
export function useAction<T = unknown>(
  path: string,
  method: string,
  keys = ['applications', 'jobs', 'stats'],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<T>(path, json(method, body)),
    onSuccess: () => {
      keys.forEach((key) => void client.invalidateQueries({ queryKey: [key] }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
export function useMove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: Status; position: number }) =>
      api(`/applications/${id}/move`, json('PATCH', { status, position })),
    onMutate: async (move) => {
      await client.cancelQueries({ queryKey: ['applications'] });
      const previous = client.getQueryData<Application[]>(['applications']);
      client.setQueryData<Application[]>(['applications'], (old) =>
        old?.map((a) =>
          a.id === move.id ? { ...a, status: move.status, position: move.position } : a,
        ),
      );
      return { previous };
    },
    onError: (error, _move, ctx) => {
      client.setQueryData(['applications'], ctx?.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['applications'] });
      void client.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
