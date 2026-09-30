// Admin loaders read /api/ai-hot/admin/* with the visitor's own cookie; the web process holds no session.
import { data, redirect } from "react-router";

const API_BASE = "";

export async function adminGet<T>(request: Request, path: string): Promise<T> {
  const res = await fetch(path, {
    credentials:"same-origin", cache:"no-store", headers: { accept: "application/json" },
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
  });
  if (res.status === 401) {
    const url = new URL(request.url);
    throw redirect(`/admin/login?${new URLSearchParams({ return: url.pathname + url.search })}`);
  }
  if (res.status === 404) throw data({ message: "not_found" }, { status: 404 });
  if (!res.ok) {
    let detail = `api ${res.status}`;
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch {
      // not JSON
    }
    throw data({ message: detail }, { status: res.status >= 500 ? 503 : res.status });
  }
  return (await res.json()) as T;
}
