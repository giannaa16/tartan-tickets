import { describe, expect, it } from "vitest";
import { formatPrice, getUpcomingEvents, pittsburghMidnight, type TicketEvent } from "@/lib/events";

const NOW = new Date("2026-10-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function makeEvent(overrides: Partial<TicketEvent>): TicketEvent {
  return {
    eventId: "evt",
    clubName: "Club",
    title: "Event",
    description: "",
    startsAt: new Date(NOW.getTime() + DAY).toISOString(),
    location: "Somewhere",
    priceCents: 1000,
    capacity: 100,
    seatsSold: 0,
    status: "published",
    ...overrides,
  };
}

const inDays = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();

describe("Story 1: upcoming events list", () => {
  it("story1_includes_only_events_in_next_7_days", () => {
    const events = [
      makeEvent({ eventId: "past", startsAt: inDays(-1) }),
      makeEvent({ eventId: "tomorrow", startsAt: inDays(1) }),
      makeEvent({ eventId: "day7", startsAt: inDays(7) }),
      makeEvent({ eventId: "day8", startsAt: inDays(8) }),
    ];
    const ids = getUpcomingEvents(events, NOW).map((e) => e.eventId);
    expect(ids).toEqual(["tomorrow", "day7"]);
  });

  it("story1_excludes_cancelled_events", () => {
    const events = [makeEvent({ eventId: "c", status: "cancelled" })];
    expect(getUpcomingEvents(events, NOW)).toEqual([]);
  });

  it("story1_sorts_soonest_first", () => {
    const events = [
      makeEvent({ eventId: "later", startsAt: inDays(5) }),
      makeEvent({ eventId: "sooner", startsAt: inDays(2) }),
      makeEvent({ eventId: "middle", startsAt: inDays(3) }),
    ];
    const ids = getUpcomingEvents(events, NOW).map((e) => e.eventId);
    expect(ids).toEqual(["sooner", "middle", "later"]);
  });

  it("story1_reports_seats_remaining_and_sold_out", () => {
    const [open, full] = getUpcomingEvents(
      [
        makeEvent({ eventId: "open", capacity: 100, seatsSold: 37, startsAt: inDays(1) }),
        makeEvent({ eventId: "full", capacity: 50, seatsSold: 50, startsAt: inDays(2) }),
      ],
      NOW,
    );
    expect(open).toMatchObject({ seatsRemaining: 63, soldOut: false });
    expect(full).toMatchObject({ seatsRemaining: 0, soldOut: true });
  });

  it("story1_public_event_hides_internal_fields", () => {
    const [event] = getUpcomingEvents([makeEvent({})], NOW);
    expect(event).not.toHaveProperty("seatsSold");
    expect(event).not.toHaveProperty("status");
  });

  it("story1_sample_times_use_pittsburgh_midnight", () => {
    // 10 PM Oct 21 in Pittsburgh is already Oct 22 in UTC; midnight must still be Oct 21 local.
    expect(new Date(pittsburghMidnight(new Date("2026-10-22T02:00:00Z"))).toISOString()).toBe(
      "2026-10-21T04:00:00.000Z",
    );
    // Winter (EST, UTC-5).
    expect(new Date(pittsburghMidnight(new Date("2026-12-15T17:30:00Z"))).toISOString()).toBe(
      "2026-12-15T05:00:00.000Z",
    );
  });

  it("story1_formats_price", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(1200)).toBe("$12.00");
    expect(formatPrice(550)).toBe("$5.50");
  });
});
