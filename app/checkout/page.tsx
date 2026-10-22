"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatPrice, type PublicEvent } from "@/lib/events";
import styles from "../page.module.css";

export default function CheckoutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.brand}>Tartan Tickets</p>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Checkout</h1>
        <Suspense fallback={<p role="status">Loading event…</p>}>
          <CheckoutForm />
        </Suspense>
      </main>
    </div>
  );
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "form"; event: PublicEvent }
  | { kind: "payment"; event: PublicEvent; holdId: string }
  | { kind: "processing" }
  | { kind: "declined" }
  | { kind: "soldout" };

function CheckoutForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = searchParams.get("eventId");

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setState({ kind: "error", message: "No event specified." });
      return;
    }
    fetch("/api/events")
      .then((r) => r.json())
      .then((data: { events: PublicEvent[] }) => {
        const event = data.events.find((e) => e.eventId === eventId);
        if (!event) {
          setState({ kind: "error", message: "Event not found or no longer upcoming." });
        } else if (event.soldOut) {
          setState({ kind: "soldout" });
        } else {
          setState({ kind: "form", event });
        }
      })
      .catch(() => setState({ kind: "error", message: "Could not load event." }));
  }, [eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    if (state.kind !== "form") return;

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name is required.");
      return;
    }
    if (trimmed.length > 100) {
      setNameError("Name must be 100 characters or fewer.");
      return;
    }

    const event = state.event;
    setState({ kind: "processing" });

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, seats, name: trimmed }),
    });

    if (res.status === 201) {
      const { holdId } = await res.json();
      setState({ kind: "payment", event, holdId });
    } else if (res.status === 409) {
      setState({ kind: "soldout" });
    } else {
      const body = await res.json();
      setState({ kind: "error", message: body.error ?? "Something went wrong." });
    }
  }

  async function handleConfirm() {
    if (state.kind !== "payment") return;
    const { holdId } = state;
    setState({ kind: "processing" });

    const res = await fetch(`/api/checkout/${holdId}/confirm`, { method: "POST" });
    if (res.status === 201) {
      const order = await res.json();
      router.push(`/orders/${order.orderId}`);
    } else {
      const body = await res.json();
      setState({ kind: "error", message: body.error ?? "Payment failed." });
    }
  }

  async function handleDecline() {
    if (state.kind !== "payment") return;
    const { holdId } = state;
    setState({ kind: "processing" });

    const res = await fetch(`/api/checkout/${holdId}/decline`, { method: "POST" });
    const body = await res.json();
    setState(body.waitlist ? { kind: "soldout" } : { kind: "declined" });
  }

  if (state.kind === "loading") {
    return <p role="status">Loading event…</p>;
  }

  if (state.kind === "processing") {
    return <p role="status">Processing…</p>;
  }

  if (state.kind === "error") {
    return (
      <div className={styles.status} role="alert">
        <p>{state.message}</p>
        <a href="/" className={styles.secondaryButton} style={{ textDecoration: "none" }}>
          Back to events
        </a>
      </div>
    );
  }

  if (state.kind === "soldout") {
    return (
      <div className={styles.status}>
        <p>This event is sold out.</p>
        <p>When Story 4 is built, you will be able to join the waitlist here.</p>
        <a href="/" className={styles.secondaryButton} style={{ textDecoration: "none" }}>
          Back to events
        </a>
      </div>
    );
  }

  if (state.kind === "declined") {
    return (
      <div className={styles.status}>
        <p>Payment was declined. Your seats have been released.</p>
        <a href="/" className={styles.secondaryButton} style={{ textDecoration: "none" }}>
          Back to events
        </a>
      </div>
    );
  }

  if (state.kind === "payment") {
    const { event } = state;
    const totalCents = event.priceCents * seats;
    return (
      <div className={styles.card} style={{ maxWidth: 480 }}>
        <p className={styles.club}>{event.clubName}</p>
        <h2 className={styles.title}>{event.title}</h2>
        <p>
          {seats} ticket{seats > 1 ? "s" : ""} —{" "}
          <strong>{totalCents === 0 ? "Free" : formatPrice(totalCents)}</strong>
        </p>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem", margin: "8px 0 20px" }}>
          No real charges are made. This is a simulated payment for demo purposes.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={handleConfirm}>
            Simulated payment
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleDecline}>
            Simulate decline
          </button>
        </div>
      </div>
    );
  }

  // state.kind === "form"
  const { event } = state;
  const maxSeats = Math.min(4, event.seatsRemaining);

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 480 }}>
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <p className={styles.club}>{event.clubName}</p>
        <h2 className={styles.title}>{event.title}</h2>
        <dl className={styles.details}>
          <div>
            <dt>Price</dt>
            <dd>{formatPrice(event.priceCents)}</dd>
          </div>
          <div>
            <dt>Seats left</dt>
            <dd>{event.seatsRemaining}</dd>
          </div>
        </dl>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="seats" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
          Number of tickets (max 4)
        </label>
        <select
          id="seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          style={{ font: "inherit", padding: "8px 12px", borderRadius: 6, border: "2px solid var(--ink)" }}
        >
          {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="name" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
          Your name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          style={{
            font: "inherit",
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "2px solid var(--ink)",
            boxSizing: "border-box",
          }}
        />
        {nameError && (
          <p role="alert" style={{ color: "var(--accent)", marginTop: 4, fontSize: "0.9rem" }}>
            {nameError}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton}>
          Continue to payment
        </button>
        <a href="/" style={{ color: "var(--ink-muted)", textDecoration: "underline", fontSize: "0.9rem" }}>
          Cancel
        </a>
      </div>
    </form>
  );
}
