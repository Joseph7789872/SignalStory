// Client-side fetch wrapper for API mutations. Centralizes two things every
// handler used to get wrong silently:
//  1. expired-session 401s → redirect to sign-in preserving the return path
//  2. non-OK responses → throw with the server's `{ error }` message so the
//     caller can toast it.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    // Session expired mid-action — send to sign-in preserving the return path.
    const rt = encodeURIComponent(location.pathname + location.search);
    location.href = `/sign-in?redirect=${rt}`;
    throw new ApiError("Your session expired — please sign in again.", 401);
  }
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(d.error ?? "Request failed", res.status);
  }
  return res;
}
