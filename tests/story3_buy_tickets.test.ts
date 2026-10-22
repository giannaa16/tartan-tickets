import { beforeEach, describe, expect, it } from "vitest";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as confirmPOST } from "@/app/api/checkout/[holdId]/confirm/route";
import { POST as declinePOST } from "@/app/api/checkout/[holdId]/decline/route";
import { GET as orderGET } from "@/app/api/orders/[id]/route";
import { GET as eventsGET } from "@/app/api/events/route";
import { _resetEventStore, getAllEvents } from "@/lib/events";
import { _resetOrderStore, expireHoldForTest, _advanceRateLimitTimeForTest } from "@/lib/orders";

function postReq(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Wrap params as a resolved Promise to match Next.js 16 dynamic route convention.
function ctx<T extends object>(params: T) {
  return { params: Promise.resolve(params) };
}

beforeEach(() => {
  _resetEventStore();
  _resetOrderStore();
});

describe("Story 3: Buy tickets", () => {
  // ── Acceptance criterion 1: cap at 4 seats, enforced on the server ──────────

  it("story3_order_cap_rejects_over_four_seats", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 5, name: "Alex Smith" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/4/);
  });

  it("story3_server_enforces_seat_cap_regardless_of_client", async () => {
    // Even if a client bypasses the UI and sends 10 seats, the server must reject it.
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 10, name: "Alex Smith" }),
    );
    expect(res.status).toBe(400);
  });

  it("story3_order_cap_allows_four_seats", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 4, name: "Alex Smith" }),
    );
    expect(res.status).toBe(201);
  });

  // ── Acceptance criterion 2: hold seats for 10 minutes ───────────────────────

  it("story3_checkout_hold_reduces_seats_remaining", async () => {
    const before = (await (await eventsGET()).json()).events.find(
      (e: { eventId: string }) => e.eventId === "evt-hackathon-kickoff",
    );

    await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 2, name: "Alex Smith" }),
    );

    const after = (await (await eventsGET()).json()).events.find(
      (e: { eventId: string }) => e.eventId === "evt-hackathon-kickoff",
    );
    // Seats remaining must drop by exactly the number held.
    expect(after.seatsRemaining).toBe(before.seatsRemaining - 2);
  });

  it("story3_expired_hold_releases_seats", async () => {
    const holdRes = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 2, name: "Alex Smith" }),
    );
    const { holdId } = await holdRes.json();

    // Force-expire the hold (simulates 10-minute timeout without sleeping).
    expireHoldForTest(holdId);

    const events = (await (await eventsGET()).json()).events;
    const event = events.find((e: { eventId: string }) => e.eventId === "evt-hackathon-kickoff");
    // evt-hackathon-kickoff: capacity=200, seatsSold=64 → 136 remaining at baseline.
    expect(event.seatsRemaining).toBe(136);
  });

  // ── Acceptance criterion 3: receipt with QR code ────────────────────────────

  it("story3_successful_payment_creates_order_with_qr", async () => {
    const holdRes = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 2, name: "Alex Smith" }),
    );
    const { holdId } = await holdRes.json();

    const confirmRes = await confirmPOST(new Request("http://localhost", { method: "POST" }), ctx({ holdId }));
    expect(confirmRes.status).toBe(201);

    const order = await confirmRes.json();
    expect(order.orderId).toBeDefined();
    // At least 128 bits = 32 hex characters (4 bits per hex char).
    expect(typeof order.qrToken).toBe("string");
    expect(order.qrToken.length).toBeGreaterThanOrEqual(32);
    expect(order.seats).toBe(2);
    expect(order.name).toBe("Alex Smith");
  });

  it("story3_order_retrievable_after_payment", async () => {
    const holdRes = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Sam Lee" }),
    );
    const { holdId } = await holdRes.json();

    const confirmRes = await confirmPOST(new Request("http://localhost", { method: "POST" }), ctx({ holdId }));
    const { orderId } = await confirmRes.json();

    const getRes = await orderGET(new Request("http://localhost"), ctx({ id: orderId }));
    expect(getRes.status).toBe(200);
    const retrieved = await getRes.json();
    expect(retrieved.orderId).toBe(orderId);
    expect(retrieved.name).toBe("Sam Lee");
  });

  // ── Acceptance criterion 4: card declined → release held seats ──────────────

  it("story3_decline_releases_held_seats", async () => {
    const holdRes = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 3, name: "Taylor Kim" }),
    );
    const { holdId } = await holdRes.json();

    const declineRes = await declinePOST(
      new Request("http://localhost", { method: "POST" }),
      ctx({ holdId }),
    );
    expect(declineRes.status).toBe(200);

    const after = (await (await eventsGET()).json()).events.find(
      (e: { eventId: string }) => e.eventId === "evt-hackathon-kickoff",
    );
    // Must be fully restored to 136 (no seats remain held or consumed).
    expect(after.seatsRemaining).toBe(136);
  });

  // ── Acceptance criterion 5: sold out during checkout → offer waitlist ────────

  it("story3_sold_out_during_checkout_offers_waitlist", async () => {
    // evt-a-cappella: capacity=150, seatsSold=147 → exactly 3 remaining.
    // Hold all 3 so the event is now sold out.
    await checkoutPOST(postReq({ eventId: "evt-a-cappella", seats: 3, name: "Jordan Rivers" }));

    // A second buyer arrives and finds zero seats available.
    const res = await checkoutPOST(
      postReq({ eventId: "evt-a-cappella", seats: 1, name: "Casey Park" }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    // Response must signal that the waitlist is available.
    expect(body.waitlist).toBe(true);
  });

  // ── Concurrency: two simultaneous buyers for the last seat ──────────────────

  it("story3_two_buyers_last_seat_only_one_succeeds", async () => {
    // Set evt-a-cappella to exactly 1 seat remaining.
    const event = getAllEvents().find((e) => e.eventId === "evt-a-cappella")!;
    event.seatsSold = event.capacity - 1;

    const [res1, res2] = await Promise.all([
      checkoutPOST(postReq({ eventId: "evt-a-cappella", seats: 1, name: "Alice" })),
      checkoutPOST(postReq({ eventId: "evt-a-cappella", seats: 1, name: "Bob" })),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(1);
  });

  // ── Name validation ──────────────────────────────────────────────────────────

  it("story3_blank_name_rejected", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("story3_whitespace_only_name_rejected", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "   " }),
    );
    expect(res.status).toBe(400);
  });

  it("story3_name_over_100_chars_rejected", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "A".repeat(101) }),
    );
    expect(res.status).toBe(400);
  });

  it("story3_name_exactly_100_chars_accepted", async () => {
    const res = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "A".repeat(100) }),
    );
    expect(res.status).toBe(201);
  });

  // ── SEC-16: checkout rate limiting ──────────────────────────────────────────

  it("blocks checkout after five attempts for the same name and event within ten minutes", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await checkoutPOST(
        postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
      );
      expect(res.status).toBe(201);
    }
    const blocked = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
    );
    expect(blocked.status).toBe(429);
  });

  it("checkout rate limit is per event and does not affect a different event", async () => {
    for (let i = 0; i < 5; i++) {
      await checkoutPOST(
        postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
      );
    }
    const blockedSameEvent = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
    );
    expect(blockedSameEvent.status).toBe(429);

    const allowedDifferentEvent = await checkoutPOST(
      postReq({ eventId: "evt-a-cappella", seats: 1, name: "Alex Smith" }),
    );
    expect(allowedDifferentEvent.status).toBe(201);
  });

  it("checkout block lifts after thirty minutes have passed", async () => {
    for (let i = 0; i < 5; i++) {
      await checkoutPOST(
        postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
      );
    }
    const blocked = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
    );
    expect(blocked.status).toBe(429);

    _advanceRateLimitTimeForTest(30 * 60 * 1000 + 1);

    const allowed = await checkoutPOST(
      postReq({ eventId: "evt-hackathon-kickoff", seats: 1, name: "Alex Smith" }),
    );
    expect(allowed.status).toBe(201);
  });
});
