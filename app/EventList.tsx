"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice, type PublicEvent } from "@/lib/events";
import styles from "./page.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; events: PublicEvent[] };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

export default function EventList() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ events: PublicEvent[] }>;
      })
      .then((data) => {
        if (!cancelled) setState({ kind: "loaded", events: data.events });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.kind === "loading") {
    return (
      <p className={styles.status} role="status">
        Loading events…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={styles.status} role="alert">
        <p>We couldn&apos;t load events right now.</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.events.length === 0) {
    return <p className={styles.status}>No upcoming events yet.</p>;
  }

  return (
    <ul className={styles.grid} aria-label="Upcoming events">
      {state.events.map((event) => (
        <li key={event.eventId}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const lowStock = !event.soldOut && event.seatsRemaining <= 10;

  return (
    <article className={styles.card} aria-labelledby={`${event.eventId}-title`}>
      <p className={styles.club}>{event.clubName}</p>
      <h2 id={`${event.eventId}-title`} className={styles.title}>
        {event.title}
      </h2>
      <p className={styles.description}>{event.description}</p>

      <dl className={styles.details}>
        <div>
          <dt>Date</dt>
          <dd>
            <time dateTime={event.startsAt}>{dateFormat.format(new Date(event.startsAt))}</time>
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{event.location}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatPrice(event.priceCents)}</dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd className={lowStock ? styles.lowStock : undefined}>
            {event.soldOut
              ? "Sold out"
              : `${event.seatsRemaining} of ${event.capacity} left`}
          </dd>
        </div>
      </dl>

      <div className={styles.actions}>
        {event.soldOut ? (
          <>
            <span className={styles.soldOutBadge}>Sold out</span>
            <button type="button" className={styles.primaryButton} disabled>
              Buy
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={notice !== null}
              onClick={() => setNotice("Coming soon: waitlist sign-up.")}
            >
              Join waitlist
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.push(`/checkout?eventId=${event.eventId}`)}
          >
            Buy
          </button>
        )}
      </div>
      <p className={styles.notice} role="status">
        {notice}
      </p>
    </article>
  );
}
