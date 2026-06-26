export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/')) {
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v\d+\/?$/, '');
    return `${apiBase}${url}`;
  }
  return url;
}
