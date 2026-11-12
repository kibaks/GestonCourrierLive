type SessionFetchOptions = {
  baseUrl: () => string;
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  onExpired: () => void;
  fetcher?: typeof fetch;
};
export function createSessionFetch(options: SessionFetchOptions): typeof fetch {
  let pending: Promise<string | null> | null = null;
  return async (input, init) => {
    const send = options.fetcher ?? fetch;
    const response = await send(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
    const sent = headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const protectedRequest = url.startsWith(options.baseUrl() + '/api/') && !/\/api\/auth\/(?!me(?:$|\?))/.test(url);
    if (response.status !== 401 || !protectedRequest || !sent || init?.signal?.aborted) return response;
    const current = options.getToken();
    if (!current) return response; // A logout must never be undone by an old request.
    let token: string | null = current;
    if (current === sent) {
      pending ??= options.refresh().finally(() => { pending = null; });
      token = await pending;
    }
    if (token && token === options.getToken()) {
      headers.set('Authorization', 'Bearer ' + token);
      const retried = await send(input, {...init, headers});
      if (retried.status === 401 && options.getToken() === token) options.onExpired();
      return retried;
    }
    if (options.getToken() === sent) options.onExpired();
    return response;
  };
}
