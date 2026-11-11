import type {
  AuthorView,
  EventView,
  FaqView,
  PostFull,
  PostSummary,
  ReleaseNoteView,
  SiteView,
  WhitepaperView,
} from '../../../contracts/v1/index';

export type CmsFetchOptions = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};
export type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };
export type ListResult<T> = { data: T[]; meta: PaginationMeta };
export type PostSlug = { slug: string; updatedAt: string };

export class CmsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'CmsApiError';
  }
}

type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
};
type ListParams = { page?: number; limit?: number };
type PostListParams = ListParams & {
  tag?: string;
  category?: string;
  featured?: boolean;
  sort?: '-publishedAt' | 'publishedAt';
  fields?: 'summary' | 'slugs';
  include?: 'author';
};

function apiBase(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

function queryString(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export function createCmsClient(options: ClientOptions) {
  const baseUrl = apiBase(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    fetchOptions: CmsFetchOptions = {},
    nullOn404 = false,
  ): Promise<T | null> {
    const headers = new Headers(fetchOptions.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${options.apiKey}`);
    headers.set('X-CMS-Client', 'cms-client/1');
    if (options.userAgent) headers.set('User-Agent', options.userAgent);
    const response = await fetchImpl(`${baseUrl}${path}`, { ...fetchOptions, headers });
    if (response.status === 304) return null;
    if (response.status === 404 && nullOn404) return null;
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        code?: unknown;
        details?: unknown;
      } | null;
      throw new CmsApiError(
        response.status,
        typeof body?.code === 'string' ? body.code : 'HTTP_ERROR',
        body?.details ?? null,
        typeof body?.error === 'string'
          ? body.error
          : `CMS request failed with HTTP ${response.status}`,
      );
    }
    if (response.status === 204) return null;
    return (await response.json()) as T;
  }

  async function data<T>(
    path: string,
    fetchOptions: CmsFetchOptions = {},
    nullOn404 = false,
  ): Promise<T | null> {
    const envelope = await request<{ data: T }>(path, fetchOptions, nullOn404);
    return envelope?.data ?? null;
  }

  async function post<T>(path: string, body: unknown, fetchOptions: CmsFetchOptions = {}) {
    const headers = new Headers(fetchOptions.headers);
    headers.set('Content-Type', 'application/json');
    return data<T>(path, {
      ...fetchOptions,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  return {
    site: {
      get: (fetchOptions?: CmsFetchOptions) => data<SiteView>('/site', fetchOptions),
    },
    posts: {
      list: (params: PostListParams = {}, fetchOptions?: CmsFetchOptions) =>
        request<ListResult<PostSummary | PostSlug>>(`/posts${queryString(params)}`, fetchOptions),
      get: (slug: string, params: { include?: string } = {}, fetchOptions?: CmsFetchOptions) =>
        data<PostFull>(
          `/posts/${encodeURIComponent(slug)}${queryString(params)}`,
          fetchOptions,
          true,
        ),
    },
    authors: {
      list: (params: ListParams = {}, fetchOptions?: CmsFetchOptions) =>
        request<ListResult<AuthorView>>(`/authors${queryString(params)}`, fetchOptions),
      get: (slug: string, fetchOptions?: CmsFetchOptions) =>
        data<AuthorView>(`/authors/${encodeURIComponent(slug)}`, fetchOptions, true),
    },
    faqs: {
      list: (params: ListParams & { category?: string } = {}, fetchOptions?: CmsFetchOptions) =>
        request<ListResult<FaqView>>(`/faqs${queryString(params)}`, fetchOptions),
    },
    whitepapers: {
      list: (params: ListParams & { tag?: string } = {}, fetchOptions?: CmsFetchOptions) =>
        request<
          ListResult<
            Omit<
              WhitepaperView,
              'content' | 'blocks' | 'metaTitle' | 'metaDescription' | 'keywords'
            >
          >
        >(`/whitepapers${queryString(params)}`, fetchOptions),
      get: (slug: string, fetchOptions?: CmsFetchOptions) =>
        data<WhitepaperView>(`/whitepapers/${encodeURIComponent(slug)}`, fetchOptions, true),
    },
    releaseNotes: {
      list: (params: ListParams = {}, fetchOptions?: CmsFetchOptions) =>
        request<ListResult<ReleaseNoteView>>(`/release-notes${queryString(params)}`, fetchOptions),
      get: (slug: string, fetchOptions?: CmsFetchOptions) =>
        data<ReleaseNoteView & { bodyMarkdown: string }>(
          `/release-notes/${encodeURIComponent(slug)}`,
          fetchOptions,
          true,
        ),
    },
    events: {
      list: (params: ListParams = {}, fetchOptions?: CmsFetchOptions) =>
        request<ListResult<EventView>>(`/events${queryString(params)}`, fetchOptions),
      get: (slug: string, fetchOptions?: CmsFetchOptions) =>
        data<EventView>(`/events/${encodeURIComponent(slug)}`, fetchOptions, true),
    },
    intake: {
      faqSubmission: (
        body: { question: string; name?: string; email?: string },
        fetchOptions?: CmsFetchOptions,
      ) => post<{ id: string; status: 'pending' }>('/intake/faq-submissions', body, fetchOptions),
      newsletter: (body: { email: string; source?: string }, fetchOptions?: CmsFetchOptions) =>
        post<{ subscribed: true; new: boolean }>(
          '/intake/newsletter-subscriptions',
          body,
          fetchOptions,
        ),
    },
  };
}
