# Tartan Tickets

Club event ticketing for CMU students. Built from Starter Spec A, in [`docs/`](docs/):
[requirements](docs/requirements.md), [security spec](docs/SECURITY_SPEC.md), and
[test spec](docs/TEST_SPEC.md). When the spec documents conflict, the stricter rule wins.

## Status

- **Done:** Story 1, Browse events. Lists events starting in the next 7 days with date,
  location, price, and seats remaining, in Pittsburgh time. Sold-out events show "Sold out",
  a disabled Buy button, and "Join waitlist". Every page sends an HSTS header (SEC-3).
- **Placeholders:** the Buy and Join waitlist buttons show "Coming soon".
- **Temporary shortcuts:** no database (sample events live in server memory and reset on
  restart), no sign-in, no real payments.

## Run it

```bash
npm install     # first time only
npm run dev     # then open http://localhost:3000
npm test        # run the automated tests
```

## Security spec audit

| ID | Requirement summary | Status | Why |
|----|---------------------|--------|-----|
| SEC-1 | Authenticate via CMU SSO; no passwords stored | Not at all | No auth or SSO integration exists; sign-in is an explicit placeholder. |
| SEC-2 | Expire session after 8 h of inactivity | Not at all | No session management of any kind is implemented. |
| SEC-3 | HTTPS only + HSTS on all pages and API routes | Fully | `next.config.ts` sets `Strict-Transport-Security: max-age=63072000; includeSubDomains` on every response; verified by `sec3_hsts_header_on_every_route` test. |
| SEC-4 | Server-side role/club membership check on every request | Not at all | No authorization middleware or role/club checks exist anywhere in the codebase. |
| SEC-5 | Return access-denied and log cross-club access attempts | Not at all | No access control or logging; any order ID can be fetched freely. |
| SEC-6 | Return "not found" (not forbidden) for another student's ticket | Not at all | `/api/orders/[id]` returns full order data for any valid ID with no ownership check. |
| SEC-7 | Use Stripe-hosted Checkout so card numbers never touch the server | Not at all | Payments are simulated in-browser; no Stripe integration exists. |
| SEC-8 | Calculate charge amount server-side; ignore browser-supplied amount | Not at all | No real charge calculation; checkout flow is a client-side simulation. |
| SEC-9 | Verify Stripe webhook signature before acting | Not at all | No webhook endpoint exists. |
| SEC-10 | Process each Stripe event ID at most once (idempotency) | Not at all | No webhook handling or idempotency logic exists. |
| SEC-11 | Store Stripe secret keys only in a secrets manager, never in source | Not at all | No Stripe keys are configured; no secrets-manager integration present. |
| SEC-12 | Require president + admin approval before redirecting Stripe payouts | Not at all | No Stripe Connect or approval workflow is implemented. |
| SEC-13 | QR token = random ≥128-bit opaque value, no PII | Fully | `lib/orders.ts` uses `crypto.randomBytes(32).toString("hex")` (256 bits, no PII); verified by `story3_successful_payment_creates_order_with_qr` test. |
| SEC-14 | Concurrent scans mark ticket checked-in exactly once | Not at all | No check-in or QR scanning feature has been built yet. |
| SEC-15 | Pause scanning 5 min after >10 invalid scans in 1 min | Not at all | No scanning logic or rate-limiting for scans exists. |
| SEC-16 | Block checkouts 30 min after >5 checkouts for one event in 10 min | Partly | Server enforces the 5-attempt / 10-min window and 30-min block, keyed by trimmed name + eventId; three tests pass. Not yet satisfied: (1) name is not a real account identity — typing a different name bypasses the limit; (2) the rate-limit store is in-memory and resets on server restart; (3) blocked attempts are not logged. |
| SEC-17 | Collect only name, Andrew email, ticket status, Stripe payment ID | Partly | `lib/orders.ts` stores name and a simulated payment ID but no Andrew email; real Stripe payment ID absent since payments are not live. |
| SEC-18 | Remove attendee names/emails 90 days after event ends | Not at all | No data-retention or purge logic exists. |
| SEC-19 | Export attendee list only for club officers; log every export | Not at all | No export feature and no export logging exist. |
| SEC-20 | Render officer-entered text as plain text (no XSS) | Fully | `app/EventList.tsx` interpolates event fields through JSX (auto-escaped); verified by `sec20_event_text_rendered_as_plain_text` test. |
| SEC-21 | Write audit log on role change, refund, cancellation, Stripe change, export | Not at all | No audit logging infrastructure exists. |
| SEC-22 | Keep audit logs append-only, admin-readable, for one year | Not at all | No audit log system of any kind is implemented. |

## Where things are

- `docs/`: the spec (requirements, security spec, test spec)
- `lib/events.ts`: sample events and the "upcoming" rules
- `app/api/events/route.ts`: `GET /api/events`
- `app/EventList.tsx`: the event list page (loading, empty, error, sold-out states)
- `app/globals.css`: named color tokens (ink, accent, surface)
- `tests/`: automated tests, named after the story they check (e.g. `story1_...`)
