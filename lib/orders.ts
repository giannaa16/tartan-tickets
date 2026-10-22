// In-memory order and seat-hold store for Story 3.
// Data resets on server restart (no database yet).

import crypto from "crypto";
import { getAllEvents } from "./events";

export type Hold = {
  holdId: string;
  eventId: string;
  seats: number;
  name: string;
  expiresAt: number; // Unix timestamp (ms)
  status: "active" | "confirmed" | "released" | "expired";
};

export type Order = {
  orderId: string;
  holdId: string;
  eventId: string;
  seats: number;
  name: string;
  qrToken: string;
  createdAt: string; // ISO 8601
};

export const MAX_SEATS = 4;
export const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// SEC-16: block an account (keyed by trimmed name + eventId) that starts more
// than 5 checkouts for one event within 10 minutes, for 30 minutes.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const RATE_BLOCK_MS = 30 * 60 * 1000;

type RateLimitEntry = { attempts: number[]; blockedUntil?: number };
const checkoutRateLimit = new Map<string, RateLimitEntry>();

// Offset used by tests to simulate time passing without real sleeps.
let _rateLimitTimeOffsetMs = 0;
function rateNow(): number {
  return Date.now() + _rateLimitTimeOffsetMs;
}

function checkRateLimit(name: string, eventId: string): void {
  const key = `${name}\0${eventId}`;
  const now = rateNow();
  const entry: RateLimitEntry = checkoutRateLimit.get(key) ?? { attempts: [] };

  if (entry.blockedUntil !== undefined && entry.blockedUntil > now) {
    const mins = Math.ceil((entry.blockedUntil - now) / 60_000);
    throw { code: 429, message: `Too many checkouts for this event. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  // Slide the window: drop attempts older than 10 minutes.
  entry.attempts = entry.attempts.filter((t) => t > now - RATE_WINDOW_MS);

  if (entry.attempts.length >= RATE_MAX) {
    entry.blockedUntil = now + RATE_BLOCK_MS;
    checkoutRateLimit.set(key, entry);
    throw { code: 429, message: "Too many checkouts for this event. Try again in 30 minutes." };
  }

  entry.attempts.push(now);
  checkoutRateLimit.set(key, entry);
}

const holds = new Map<string, Hold>();
const orders = new Map<string, Order>();

// Expire any holds whose timer has run out and return their seats to the pool.
function expireStaleHolds(): void {
  const now = Date.now();
  for (const hold of holds.values()) {
    if (hold.status === "active" && hold.expiresAt < now) {
      hold.status = "expired";
      returnSeats(hold.eventId, hold.seats);
    }
  }
}

function returnSeats(eventId: string, seats: number): void {
  const event = getAllEvents().find((e) => e.eventId === eventId);
  if (event) event.seatsSold = Math.max(0, event.seatsSold - seats);
}

// Start checkout: validate inputs, reserve seats, return a hold.
// Throws a plain object { code, message, waitlist? } on failure.
export function createHold(eventId: string, seats: number, name: string): Hold {
  expireStaleHolds();

  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw { code: 400, message: `You may buy 1 to ${MAX_SEATS} tickets per order.` };
  }

  const trimmed = name.trim();
  if (!trimmed) throw { code: 400, message: "Name is required." };
  if (trimmed.length > 100) throw { code: 400, message: "Name must be 100 characters or fewer." };

  checkRateLimit(trimmed, eventId);

  const event = getAllEvents().find((e) => e.eventId === eventId);
  if (!event || event.status !== "published") {
    throw { code: 404, message: "Event not found." };
  }

  const available = event.capacity - event.seatsSold;
  if (available < seats) {
    throw { code: 409, message: "Not enough seats available.", waitlist: true };
  }

  // Increment seatsSold immediately so concurrent requests see updated inventory.
  event.seatsSold += seats;

  const holdId = crypto.randomBytes(16).toString("hex");
  const hold: Hold = {
    holdId,
    eventId,
    seats,
    name: trimmed,
    expiresAt: Date.now() + HOLD_DURATION_MS,
    status: "active",
  };
  holds.set(holdId, hold);
  return hold;
}

// Confirm a simulated payment: mark hold confirmed, create and store an order.
export function confirmHold(holdId: string): Order {
  expireStaleHolds();

  const hold = holds.get(holdId);
  if (!hold) throw { code: 404, message: "Hold not found." };
  if (hold.status === "expired") {
    throw { code: 409, message: "Your checkout session expired. Seats have been released." };
  }
  if (hold.status !== "active") {
    throw { code: 409, message: "Hold is no longer active." };
  }

  hold.status = "confirmed";

  // QR token: 32 random bytes = 256 bits (well above the 128-bit minimum in SEC-13).
  const qrToken = crypto.randomBytes(32).toString("hex");
  const orderId = crypto.randomBytes(16).toString("hex");

  const order: Order = {
    orderId,
    holdId,
    eventId: hold.eventId,
    seats: hold.seats,
    name: hold.name,
    qrToken,
    createdAt: new Date().toISOString(),
  };
  orders.set(orderId, order);
  return order;
}

// Simulate a declined payment: release held seats back to the pool.
export function releaseHold(holdId: string): { eventSoldOut: boolean } {
  expireStaleHolds();

  const hold = holds.get(holdId);
  if (!hold) throw { code: 404, message: "Hold not found." };
  if (hold.status !== "active") throw { code: 409, message: "Hold is no longer active." };

  hold.status = "released";
  returnSeats(hold.eventId, hold.seats);

  const event = getAllEvents().find((e) => e.eventId === hold.eventId);
  const available = event ? event.capacity - event.seatsSold : 0;
  return { eventSoldOut: available === 0 };
}

export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

// ── Test helpers ─────────────────────────────────────────────────────────────

export function _resetOrderStore(): void {
  holds.clear();
  orders.clear();
  checkoutRateLimit.clear();
  _rateLimitTimeOffsetMs = 0;
}

// Advance the rate-limiter's view of the clock without real sleeps.
export function _advanceRateLimitTimeForTest(ms: number): void {
  _rateLimitTimeOffsetMs += ms;
}

// Force-expire a specific hold without waiting for the real 10-minute clock.
export function expireHoldForTest(holdId: string): void {
  const hold = holds.get(holdId);
  if (hold && hold.status === "active") {
    hold.status = "expired";
    returnSeats(hold.eventId, hold.seats);
  }
}
