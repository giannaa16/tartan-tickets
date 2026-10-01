import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventList from "@/app/EventList";
import type { PublicEvent } from "@/lib/events";

function makeEvent(overrides: Partial<PublicEvent>): PublicEvent {
  return {
    eventId: "evt-1",
    clubName: "ScottyLabs",
    title: "Hackathon Kickoff",
    description: "Meet teammates.",
    startsAt: "2026-10-03T22:00:00Z",
    location: "Cohon Center",
    priceCents: 1200,
    capacity: 120,
    seatsRemaining: 37,
    soldOut: false,
    ...overrides,
  };
}

function mockFetch(response: Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(() => response));
}

const ok = (events: PublicEvent[]) =>
  Promise.resolve(new Response(JSON.stringify({ events }), { status: 200 }));

afterEach(() => vi.unstubAllGlobals());

describe("Story 1: browse events page", () => {
  it("story1_shows_date_location_price_and_seats_remaining", async () => {
    mockFetch(ok([makeEvent({})]));
    render(<EventList />);

    const card = await screen.findByRole("article", { name: "Hackathon Kickoff" });
    expect(within(card).getByText("ScottyLabs")).toBeInTheDocument();
    expect(within(card).getByText(/Sat, Oct 3/)).toBeInTheDocument();
    expect(within(card).getByText("Cohon Center")).toBeInTheDocument();
    expect(within(card).getByText("$12.00")).toBeInTheDocument();
    expect(within(card).getByText("37 of 120 left")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Buy" })).toBeEnabled();
  });

  it("story1_free_event_shows_free", async () => {
    mockFetch(ok([makeEvent({ priceCents: 0 })]));
    render(<EventList />);
    expect(await screen.findByText("Free")).toBeInTheDocument();
  });

  it("story1_sold_out_shows_join_waitlist_instead_of_buy", async () => {
    mockFetch(ok([makeEvent({ seatsRemaining: 0, soldOut: true })]));
    render(<EventList />);

    const card = await screen.findByRole("article");
    expect(within(card).queryByRole("button", { name: "Buy" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Join waitlist" })).toBeInTheDocument();
    expect(within(card).getAllByText("Sold out").length).toBeGreaterThan(0);
  });

  it("story1_buy_shows_coming_soon_and_disables_after_one_click", async () => {
    mockFetch(ok([makeEvent({})]));
    render(<EventList />);

    const buy = await screen.findByRole("button", { name: "Buy" });
    await userEvent.click(buy);
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
    expect(buy).toBeDisabled();
  });

  it("story1_waitlist_shows_coming_soon", async () => {
    mockFetch(ok([makeEvent({ seatsRemaining: 0, soldOut: true })]));
    render(<EventList />);

    await userEvent.click(await screen.findByRole("button", { name: "Join waitlist" }));
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
  });

  it("story1_empty_state_message", async () => {
    mockFetch(ok([]));
    render(<EventList />);
    expect(await screen.findByText("No upcoming events yet.")).toBeInTheDocument();
  });

  it("story1_loading_state", () => {
    mockFetch(new Promise<Response>(() => {}));
    render(<EventList />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading events");
  });

  it("story1_error_state_with_retry", async () => {
    mockFetch(Promise.resolve(new Response("oops", { status: 500 })));
    render(<EventList />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("couldn't load events");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("sec20_event_text_rendered_as_plain_text", async () => {
    const script = '<script>alert("hi")</script>';
    mockFetch(ok([makeEvent({ title: script, description: script })]));
    const { container } = render(<EventList />);

    expect((await screen.findAllByText(script)).length).toBe(2);
    expect(container.querySelector("script")).toBeNull();
  });
});
