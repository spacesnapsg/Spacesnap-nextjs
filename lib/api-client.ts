export class ApiRequestError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errors: Record<string, string[]> | undefined =
      body && typeof body === "object" && "errors" in body ? (body.errors as Record<string, string[]>) : undefined;
    // Field-level messages (e.g. "Insufficient credit balance for this
    // request.") are more useful to show than the generic top-level
    // "The given data was invalid." wrapper every ApiValidationError shares.
    const fieldMessages: string[] = errors ? Object.values(errors).flat() : [];
    const message =
      fieldMessages.length > 0
        ? fieldMessages.join(" ")
        : body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `Request to ${url} failed with status ${res.status}.`;
    throw new ApiRequestError(message, res.status, errors);
  }

  return body as T;
}
