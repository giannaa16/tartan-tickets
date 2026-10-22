import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/events/route";
import nextConfig from "@/next.config";

describe("SEC-3: HTTPS only", () => {
  it("sec3_hsts_header_on_every_route", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*");
    const hsts = all?.headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toMatch(/max-age=\d{8,}/);
  });
});

describe("Story 1: GET /api/events", () => {
  it("story1_api_returns_200_with_upcoming_events", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);

    const now = Date.now();
    for (const e of body.events) {
      const t = new Date(e.startsAt).getTime();
      expect(t).toBeGreaterThanOrEqual(now - 60_000);
      expect(t).toBeLessThanOrEqual(now + 7 * 24 * 60 * 60 * 1000);
      expect(e).toHaveProperty("location");
      expect(e).toHaveProperty("priceCents");
      expect(e).toHaveProperty("seatsRemaining");
    }
  });
});
