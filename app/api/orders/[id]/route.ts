import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const order = getOrder(id);
  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  return Response.json(order);
}
