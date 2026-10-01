import { getUpcomingEvents } from "@/lib/events";

// "Upcoming" depends on the current time, so never serve a cached copy.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ events: getUpcomingEvents() });
}
