type ApiFetchInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function isJsonBody(value: ApiFetchInit["body"]): value is Record<string, unknown> | unknown[] {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  if (value instanceof FormData) return false;
  if (value instanceof URLSearchParams) return false;
  if (value instanceof Blob) return false;
  if (value instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(value)) return false;

  return true;
}

async function readPayload(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();

  if (!text) return undefined;

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const message = Reflect.get(payload, "message");
    if (typeof message === "string" && message.trim()) return message;

    const error = Reflect.get(payload, "error");
    if (typeof error === "string" && error.trim()) return error;
  }

  if (typeof payload === "string" && payload.trim()) return payload;
  return fallback;
}

export async function apiFetch<T = void>(input: RequestInfo | URL, init: ApiFetchInit = {}) {
  const { response, payload } = await apiRequest(input, init);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, "请求失败"), response.status, payload);
  }

  return payload as T;
}

export async function apiFetchBlob(input: RequestInfo | URL, init: ApiFetchInit = {}) {
  const { response, payload } = await apiRequest(input, init);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, "请求失败"), response.status, payload);
  }

  return response.blob();
}

export async function apiFetchOk(input: RequestInfo | URL, init: ApiFetchInit = {}) {
  try {
    await apiFetch(input, init);
    return true;
  } catch {
    return false;
  }
}

async function apiRequest(input: RequestInfo | URL, init: ApiFetchInit) {
  const headers = new Headers(init.headers);
  let body = init.body;

  if (isJsonBody(body)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    body,
  });

  const payload = await readPayload(response.clone());
  return { response, payload };
}
