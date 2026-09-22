/** Thin HTTP client for the money-manager API, authenticated with an API key. */

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class MoneyManagerClient {
  private baseUrl: string;
  private apiKey: string;
  private fetchFn: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('x-api-key', this.apiKey);
    const res = await this.fetchFn(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep default message
      }
      throw new ApiError(res.status, message);
    }
    return res.json() as Promise<T>;
  }

  listAccounts() {
    return this.request<{ accounts: unknown[] }>('/api/accounts');
  }

  listCategories() {
    return this.request<{ categories: unknown[] }>('/api/categories');
  }

  addTransaction(input: Record<string, unknown>) {
    return this.request<{ transaction: unknown }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listTransactions(query: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return this.request<{ transactions: unknown[] }>(`/api/transactions${qs ? `?${qs}` : ''}`);
  }

  getSummary(from: string, to: string) {
    return this.request(`/api/stats/summary?from=${from}&to=${to}`);
  }

  getBudgetStatus(month: string) {
    return this.request(`/api/budgets/status?month=${month}`);
  }
}
