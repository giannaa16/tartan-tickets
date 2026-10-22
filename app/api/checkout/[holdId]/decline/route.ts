import { releaseHold } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ holdId: string }> },
) {
  const { holdId } = await ctx.params;

  try {
    const { eventSoldOut } = releaseHold(holdId);
    return Response.json({
      message: "Seats released.",
      ...(eventSoldOut ? { waitlist: true } : {}),
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    return Response.json({ error: e.message ?? "Something went wrong." }, { status: e.code ?? 500 });
  }
}
