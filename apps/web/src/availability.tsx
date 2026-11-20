import { useState } from "react";
import { headers } from "./owner-access";
export function Availability({
  input,
}: {
  input: {
    item: string;
    start: string;
    due: string;
    quantity: number;
    other: { start: string; due: string; units: number }[];
  };
}) {
  const [message, M] = useState(""),
    [busy, B] = useState(false);
  async function check() {
    B(true);
    try {
      const r = await fetch("/api/availability", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      });
      const data = await r.json();
      M(
        r.ok
          ? data.available +
              " available for these dates" +
              (data.shortage
                ? " · Short by " + data.shortage
                : data.atRisk
                  ? " · Depends on an expected return"
                  : "")
          : data.message,
      );
    } catch {
      M("Could not check stock. Try again.");
    } finally {
      B(false);
    }
  }
  return (
    <div>
      <button type="button" disabled={busy} onClick={check}>
        Check availability
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
