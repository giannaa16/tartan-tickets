import { createHold } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { eventId, seats, name } = body as {
    eventId?: unknown;
    seats?: unknown;
    name?: unknown;
  };

  if (typeof eventId !== "string" || typeof name !== "string" || typeof seats !== "number") {
    return Response.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  try {
    const hold = createHold(eventId, seats, name);
    return Response.json(
      { holdId: hold.holdId, expiresAt: new Date(hold.expiresAt).toISOString() },
      { status: 201 },
    );
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; waitlist?: boolean };
    return Response.json(
      { error: e.message ?? "Something went wrong.", ...(e.waitlist ? { waitlist: true } : {}) },
      { status: e.code ?? 500 },
    );
  }
}
