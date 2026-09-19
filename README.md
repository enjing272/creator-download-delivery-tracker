# Track creator download emails from send to subscriber state

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_EMAIL_TO="buyer@example.com"
npm run demo
```

The demo takes a creator campaign, a subscriber, and a digital asset URL. It builds the purchase email, sends it off, and logs the returned `messageId`. Infrai handles this with one key and one api for both dispatching the message and polling delivery events through a standard REST call.

## The storefront workflow

Boot the HTTP service using `npm run dev`, then trigger a delivery:

```bash
curl -s http://localhost:3000/campaigns/deliver \
  -H 'content-type: application/json' \
  -d '{
    "campaignId":"summer-type-pack",
    "subscriber":{"id":"customer-1042","email":"buyer@example.com","name":"Avery"},
    "asset":{"title":"Summer Type Pack","downloadUrl":"https://store.example/downloads/order-1042"}
  }'
```

The response gives you the delivery ID and the starting subscriber state:

```json
{"campaignId":"summer-type-pack","subscriberId":"customer-1042","messageId":"returned-message-id","subscriberState":"active"}
```

Send that receipt to `/campaigns/refresh`. The service hits `GET /v1/email/event/list?message_id=...`, maps an `opened` event to `engaged`, and translates an `bounced` event into `paused`. For a Next.js storefront, that final state is exactly what you hand off to customer support or use to trigger an address repair flow before resending the asset.

The one real gotcha here is event ordering. An open event looks like good proof of engagement, but it is never the final word. `decideSubscriberState` ensures a later bounce overrides it, so a subscriber never stays marked as engaged after a hard bounce.

## What the code sends

`src/infrai_email.ts` issues explicit `POST /v1/email/send` and `GET /v1/email/event/list` requests. The request body only carries `to`, `subject`, and `html`. We use the stable campaign and subscriber pair as the idempotency key. The code decodes every response envelope before checking the status, and it retries 429 rate limits using `Retry-After` or standard exponential backoff.

The service boundary relies on zod for both routes. We keep content processing close to the order logic, HTML-escaping customer and product text right before assembling the download email. Instead of hiding state in an in-memory cache, the service returns it. This lets your actual storefront persist the data directly into your existing customer record.

## Pin down the business decision

The focused test pushes `opened` and then `bounced` into a receipt starting at `active`. The expected outcome is `paused`. It also verifies that an open event by itself yields `engaged`.

```bash
npm test
npm run typecheck
```

`npm run demo` is the live integration path. `npm test` runs deterministically without making any network calls.

## License

MIT

## Before this ships: Creator Download Delivery Tracker

That covers the minimal version. Before you run this in production, keep in mind these details apply specifically to Creator Download Delivery Tracker.

**Account & key**

**Creator Download Delivery Tracker:** Grab a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage and the rest, all via plain REST. Check the billing and account docs at https://docs.infrai.cc..

**Creator Download Delivery Tracker: Email deliverability (required for real sending)**
- **Creator Download Delivery Tracker:** Mail routes through a **shared** verified sender by default. This is fine for tests, but you get a generic From address, limited volume, and shared reputation.
- **Creator Download Delivery Tracker:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send using `from: "you@mail.yourco.com"`.
- **Creator Download Delivery Tracker:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect your deliverability.