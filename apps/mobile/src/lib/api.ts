import { API_URL } from './config';
import { tokenStorage } from './storage';

const ACCESS = 'mm.accessToken';
const REFRESH = 'mm.refreshToken';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function rawFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = await tokenStorage.get(REFRESH);
  if (!refreshToken) return false;
  const res = await rawFetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  await tokenStorage.set(ACCESS, body.accessToken);
  await tokenStorage.set(REFRESH, body.refreshToken);
  return true;
}

/** Authenticated JSON request — attaches the stored access token, refreshes once on 401. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let token = await tokenStorage.get(ACCESS);
  let res = await rawFetch(path, init, token ?? undefined);

  if (res.status === 401) {
    refreshing = refreshing ?? tryRefresh().finally(() => (refreshing = null));
    if (await refreshing) {
      token = await tokenStorage.get(ACCESS);
      res = await rawFetch(path, init, token ?? undefined);
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await tokenStorage.set(ACCESS, accessToken);
  await tokenStorage.set(REFRESH, refreshToken);
}

export async function clearTokens() {
  await tokenStorage.remove(ACCESS);
  await tokenStorage.remove(REFRESH);
}

export async function hasTokens() {
  return (await tokenStorage.get(REFRESH)) !== null;
}

/** Unauthenticated call for /api/auth/* endpoints. */
export async function publicApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await rawFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
