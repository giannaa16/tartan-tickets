"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Order } from "@/lib/orders";
import styles from "../../page.module.css";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "loaded"; order: Order };

export default function OrderPage() {
  const params = useParams();
  const id = params.id as string;
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<Order>;
      })
      .then((order) => setState({ kind: "loaded", order }))
      .catch(() => setState({ kind: "error" }));
  }, [id]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.brand}>Tartan Tickets</p>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Order confirmed</h1>

        {state.kind === "loading" && <p role="status">Loading…</p>}

        {state.kind === "error" && (
          <div className={styles.status} role="alert">
            <p>Order not found.</p>
            <a href="/" className={styles.secondaryButton} style={{ textDecoration: "none" }}>
              Back to events
            </a>
          </div>
        )}

        {state.kind === "loaded" && (
          <div className={styles.card} style={{ maxWidth: 480 }}>
            <p className={styles.club}>Receipt</p>
            <p style={{ margin: "8px 0 16px" }}>
              Thank you, <strong>{state.order.name}</strong>! Your order is confirmed.
            </p>

            <dl className={styles.details}>
              <div>
                <dt>Tickets</dt>
                <dd>{state.order.seats}</dd>
              </div>
              <div>
                <dt>Ordered</dt>
                <dd>
                  {new Date(state.order.createdAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>

            <div style={{ marginTop: 20, marginBottom: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Your check-in code</p>
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                  background: "var(--surface-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "12px",
                }}
              >
                {state.order.qrToken}
              </p>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 6 }}>
                Show this code at the door to check in. (Story 6 will scan it.)
              </p>
            </div>

            <a href="/" style={{ color: "var(--ink-muted)", fontSize: "0.9rem", textDecoration: "underline" }}>
              Back to events
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
