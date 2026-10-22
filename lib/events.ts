// Event data and the rules for which events count as "upcoming".
// Data lives in server memory for now (no database yet), so it resets on restart.

export type EventStatus = "published" | "cancelled";

export type TicketEvent = {
  eventId: string;
  clubName: string;
  title: string;
  description: string;
  startsAt: string; // ISO 8601 timestamp
  location: string;
  priceCents: number;
  capacity: number;
  seatsSold: number;
  status: EventStatus;
};

// What /api/events returns for each event.
export type PublicEvent = Omit<TicketEvent, "seatsSold" | "status"> & {
  seatsRemaining: number;
  soldOut: boolean;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// "Upcoming" means starting within the next 7 days.
export const UPCOMING_WINDOW_MS = 7 * DAY;

// Midnight in Pittsburgh on the day of `now`, as a timestamp. Uses Pittsburgh time
// rather than the server's clock, because hosts like Vercel run on UTC.
export function pittsburghMidnight(now: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return Date.UTC(parts.year, parts.month - 1, parts.day) - offsetMs;
}

// Sample dates are relative to midnight (Pittsburgh time) on the day the server
// starts, so the demo always has upcoming events at sensible times of day.
function seedEvents(now: Date): TicketEvent[] {
  const midnight = pittsburghMidnight(now);
  const at = (offsetMs: number) => new Date(midnight + offsetMs).toISOString();
  return [
    {
      eventId: "evt-fall-show",
      clubName: "Scotch'n'Soda Theatre",
      title: "Fall Musical: Opening Night",
      description: "The student-run theatre troupe's fall production.",
      startsAt: at(2 * DAY + 19 * HOUR),
      location: "Purnell Center, Rangos Theater",
      priceCents: 1200,
      capacity: 120,
      seatsSold: 83,
      status: "published",
    },
    {
      eventId: "evt-hackathon-kickoff",
      clubName: "ScottyLabs",
      title: "Hackathon Kickoff Mixer",
      description: "Meet teammates and hear this year's challenge prompts.",
      startsAt: at(1 * DAY + 18 * HOUR),
      location: "Cohon University Center, Rangos Ballroom",
      priceCents: 0,
      capacity: 200,
      seatsSold: 64,
      status: "published",
    },
    {
      eventId: "evt-diwali-dinner",
      clubName: "Mayur SASA",
      title: "Diwali Dinner",
      description: "A celebration dinner with performances.",
      startsAt: at(5 * DAY + 18 * HOUR),
      location: "Cohon University Center, Wright Rooms",
      priceCents: 1500,
      capacity: 80,
      seatsSold: 80,
      status: "published",
    },
    {
      eventId: "evt-a-cappella",
      clubName: "The Originals",
      title: "Fall A Cappella Concert",
      description: "An evening of a cappella from the Originals.",
      startsAt: at(3 * DAY + 20 * HOUR),
      location: "McConomy Auditorium",
      priceCents: 800,
      capacity: 150,
      seatsSold: 147,
      status: "published",
    },
    {
      eventId: "evt-entrepreneurship-panel",
      clubName: "Tartan Entrepreneurs",
      title: "Founders Panel: From Dorm Room to Startup",
      description: "Alumni founders share how they got started.",
      startsAt: at(6 * DAY + 17 * HOUR),
      location: "Tepper Quad, Simmons Auditorium",
      priceCents: 500,
      capacity: 90,
      seatsSold: 22,
      status: "published",
    },
    {
      eventId: "evt-film-night",
      clubName: "CMU Film Club",
      title: "Midnight Movie Marathon",
      description: "Three cult classics back to back. Snacks included.",
      startsAt: at(4 * DAY + 23 * HOUR),
      location: "Doherty Hall 2210",
      priceCents: 300,
      capacity: 60,
      seatsSold: 12,
      status: "published",
    },
    // Not upcoming: more than a week away.
    {
      eventId: "evt-spring-carnival-preview",
      clubName: "Spring Carnival Committee",
      title: "Booth Design Preview",
      description: "Early look at this year's booth themes.",
      startsAt: at(12 * DAY),
      location: "Midway, The Cut",
      priceCents: 0,
      capacity: 300,
      seatsSold: 0,
      status: "published",
    },
    // Not upcoming: already started.
    {
      eventId: "evt-past-lecture",
      clubName: "Philosophy Club",
      title: "Ethics of AI Lecture",
      description: "A talk that already happened.",
      startsAt: at(-1 * DAY),
      location: "Baker Hall A51",
      priceCents: 0,
      capacity: 100,
      seatsSold: 40,
      status: "published",
    },
  ];
}

const store: TicketEvent[] = seedEvents(new Date());

export function getAllEvents(): TicketEvent[] {
  return store;
}

export function toPublicEvent(event: TicketEvent): PublicEvent {
  const seatsRemaining = Math.max(0, event.capacity - event.seatsSold);
  return {
    eventId: event.eventId,
    clubName: event.clubName,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    location: event.location,
    priceCents: event.priceCents,
    capacity: event.capacity,
    seatsRemaining,
    soldOut: seatsRemaining === 0,
  };
}

// Published events starting between now and 7 days from now, soonest first.
export function getUpcomingEvents(
  events: TicketEvent[] = store,
  now: Date = new Date(),
): PublicEvent[] {
  const start = now.getTime();
  const end = start + UPCOMING_WINDOW_MS;
  return events
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return e.status === "published" && t >= start && t <= end;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map(toPublicEvent);
}

export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return `$${(priceCents / 100).toFixed(2)}`;
}

// For testing only: re-seed the store (or replace it with custom events).
export function _resetEventStore(customEvents?: TicketEvent[]): void {
  store.length = 0;
  store.push(...(customEvents ?? seedEvents(new Date())));
}
