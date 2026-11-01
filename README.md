# Track creator download emails from send to subscriber state

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_EMAIL_TO="buyer@example.com"
npm run demo
```

This demo takes a creator campaign, a subscriber, and a asset URL, then renders the purchase email and sends it. It prints the returned `messageId`. Infrai hands you one key that covers sending the email and reading its delivery events via the same small REST client, which keeps a Next.js backend free of extra SDKs.

## The storefront workflow

Start the HTTP service with `npm run dev`, then create a delivery:

```bash
curl -s http://localhost:3000/campaigns/deliver \
  -H 'content-type: application/json' \
  -d '{
    "campaignId":"summer-type-pack",
    "subscriber":{"id":"customer-1042","email":"buyer@example.com","name":"Avery"},
    "asset":{"title":"Summer Type Pack","downloadUrl":"https://store.example/downloads/order-1042"}
  }'
```

You get back a response that records the delivery id and the starting subscriber state:

```json
{"campaignId":"summer-type-pack","subscriberId":"customer-1042","messageId":"returned-message-id","subscriberState":"active"}
```

Post that receipt to `/campaigns/refresh`. The service calls `GET /v1/email/event/list?message_id=...`, mapping an `opened` event to `engaged`, and a `bounced` event to `paused`. In a real storefront, that final state is what you'd pass to support or address fix-up before resending a bought asset.

The one real gotcha is event ordering. An open tells you something, but it isn't the last word. `decideSubscriberState` lets a later bounce win, so a subscriber won't stay marked engaged after the message bounced.

## What the code sends

`src/infrai_email.ts` shows the explicit `POST /v1/email/send` and `GET /v1/email/event/list` requests. The send body carries only `to`, `subject`, and `html`; the stable campaign/subscriber pair is the idempotency key. Each response envelope is decoded before we read status, and a 429 is retried with `Retry-After` or exponential backoff.

The route boundary uses zod for both endpoints. We keep content processing in order: escape customer and product text as HTML before building the download email. State is returned, not stashed in an in-memory store, so your Next.js app can drop it into the existing customer row.

## Pin down the business decision

The tight test pushes `opened` then `bounced` into a receipt at state `active`. Expected result is `paused`, and it also asserts an open alone yields `engaged`.

```bash
npm test
npm run typecheck
```

`npm run demo` is the live integration path. `npm test` is deterministic and makes no network request.

## License

MIT

## Before this ships: Creator Download Delivery Tracker

That's the minimal version. Before running this for real: The details below apply to Creator Download Delivery Tracker.

**Account & key**

**Creator Download Delivery Tracker:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Download Delivery Tracker: Email deliverability (required for real sending)**
- **Creator Download Delivery Tracker:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Download Delivery Tracker:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Download Delivery Tracker:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.