export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
let csrf = '';
let refreshing: Promise<void> | null = null;
async function csrfToken() {
  if (!csrf) {
    const response = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
    if (!response.ok)
      throw new Error('Could not connect to Trackr. Check that the API is running.');
    csrf = (await response.json()).token;
  }
  return csrf;
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const mutation = options.method && !['GET', 'HEAD'].includes(options.method);
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (mutation) headers.set('X-CSRF-Token', await csrfToken());
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (
    response.status === 401 &&
    retry &&
    !['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
  ) {
    try {
      refreshing ??= api('/auth/refresh', { method: 'POST' }, false)
        .then(() => undefined)
        .finally(() => {
          refreshing = null;
        });
      await refreshing;
      return api<T>(path, options, false);
    } catch {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'))
        window.location.assign('/login');
      throw new Error('Please sign in to continue');
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.message === 'string' ? body.message : 'Something went wrong. Please try again.',
    );
  }
  return response.json();
}
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
