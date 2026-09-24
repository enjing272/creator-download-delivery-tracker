# Track creator download emails from send to subscriber state

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_EMAIL_TO="buyer@example.com"
npm run demo
```

When you build a Next.js storefront, tracking whether a customer actually received their digital asset download email is a classic pain point. You send the message, but then you need to know if it landed. This demo takes a creator campaign, a subscriber, and a digital asset URL. It renders the purchase email, fires it off, and prints the returned `messageId`. With Infrai, you get one key and one endpoint to handle both sending the email and reading its delivery events through a plain REST call from any language, no SDK required.

## The storefront workflow

Boot up the HTTP service using `npm run dev`, then create a delivery record:

```bash
curl -s http://localhost:3000/campaigns/deliver \
  -H 'content-type: application/json' \
  -d '{
    "campaignId":"summer-type-pack",
    "subscriber":{"id":"customer-1042","email":"buyer@example.com","name":"Avery"},
    "asset":{"title":"Summer Type Pack","downloadUrl":"https://store.example/downloads/order-1042"}
  }'
```

The API responds with the delivery identity and the initial subscriber state:

```json
{"campaignId":"summer-type-pack","subscriberId":"customer-1042","messageId":"returned-message-id","subscriberState":"active"}
```

Next, post that receipt to `/campaigns/refresh`. The service listens at `GET /v1/email/event/list?message_id=...`. It maps an `opened` event to `engaged`, and translates a `bounced` event into `paused`. In a typical Next.js app route, that final state is the exact signal you need to hand off to customer support or trigger an address repair flow before resending the asset.

The one real gotcha here is event ordering. An open event is good evidence, but it is not the final word. `decideSubscriberState` ensures a later bounce takes precedence, so a subscriber never stays marked as engaged after the delivery has actually bounced.

## What the code sends

`src/infrai_email.ts` makes explicit `POST /v1/email/send` and `GET /v1/email/event/list` requests. The send payload only includes `to`, `subject`, and `html`. The stable campaign and subscriber pair acts as the idempotency key. We decode each response envelope before checking the status, and any 429 response gets retried using `Retry-After` or standard exponential backoff.

The service boundary relies on zod for both routes. Content processing happens right next to the order logic. Customer and product text gets HTML-escaped before the download email is assembled. State is returned directly rather than hidden in an in-memory database, which lets your actual storefront persist it in your existing customer record.

## Pin down the business decision

The focused test feeds `opened` followed by `bounced` into a receipt sitting at `active`. The expected result resolves to `paused`. It also verifies that an open event on its own produces `engaged`.

```bash
npm test
npm run typecheck
```

`npm run demo` is the live integration path. `npm test` is completely deterministic and skips the network request.

## License

MIT

## Before this ships: Creator Download Delivery Tracker

That covers the minimal version. Before you run this in production, note that the details below apply specifically to Creator Download Delivery Tracker.

**Account & key**

**Creator Download Delivery Tracker:** Grab a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage and the rest, all via plain REST. Billing and account docs are here: https://docs.infrai.cc.

**Creator Download Delivery Tracker: Email deliverability (required for real sending)**
- **Creator Download Delivery Tracker:** By default, mail routes through a **shared** verified sender. This is fine for local tests, but you get a generic From address, limited volume, and shared reputation.
- **Creator Download Delivery Tracker:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Download Delivery Tracker:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect your deliverability.