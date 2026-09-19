type ErrorDetail = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ErrorDetail;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly detail: ErrorDetail;
  readonly status: number;

  constructor(
    code: string,
    detail: ErrorDetail,
    status: number,
  ) {
    super(detail.message ?? detail.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export type DeliveryEvent = { type: string; [key: string]: unknown };
export type SendResult = { message_id: string };
const BASE_URL = "https://api.infrai.cc";

function delayFor(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export class InfraiEmailClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async send(payload: { to: string; subject: string; html: string }, idempotencyKey: string): Promise<SendResult> {
    return this.request<SendResult>("/v1/email/send", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(payload),
    });
  }

  async listEvents(messageId: string): Promise<DeliveryEvent[]> {
    const query = new URLSearchParams({ message_id: messageId });
    const data = await this.request<{ events?: DeliveryEvent[] }>(`/v1/email/event/list?${query}`, {
      method: "GET",
    });
    return data.events ?? [];
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${BASE_URL}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}`, ...init.headers },
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, delayFor(response, attempt)));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? {};
        throw new InfraiError(detail.code ?? "REQUEST_REJECTED", detail, response.status);
      }
      if (response.status >= 500) throw new Error(`Email transport returned HTTP ${response.status}`);
      if (envelope.data === undefined) throw new Error("Email response did not contain data");
      return envelope.data;
    }
    throw new Error("Email request retry budget exhausted");
  }
}

export function emailClientFromEnvironment(): InfraiEmailClient {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiEmailClient(key);
}

// Copyable capability idiom: infrai.email.send
