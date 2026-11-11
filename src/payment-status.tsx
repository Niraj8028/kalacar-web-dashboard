import { useEffect, useState } from "react";
import { StatusChip } from "./dashboard-ui";

type PaymentStatus = { mode: "test" | "live" | "unconfigured"; secretSet: boolean; checkoutOpen: boolean; webhookSet: boolean };

function describe(status: PaymentStatus): { chip: string; tone: "success" | "warning" | "danger"; detail: string } {
  if (status.mode === "test" && status.checkoutOpen) return { chip: "Test mode", tone: "warning", detail: "Customers can go through checkout, but no real money is taken. Orders are test activity, not live sales." };
  if (status.mode === "test") return { chip: "Not ready", tone: "danger", detail: "A test key is set, but its secret is missing, so checkout can't take payments." };
  if (status.mode === "live" && status.checkoutOpen) return { chip: "Live", tone: "success", detail: "Customers pay with real money. Orders are real sales." };
  if (status.mode === "live") return { chip: "Not ready", tone: "danger", detail: "A live key is set, but its secret is missing, so checkout can't take payments." };
  return { chip: "Not set up", tone: "danger", detail: "No Razorpay key is set, so checkout can't take payments." };
}

/** Read-only. Razorpay keys are kept in the server's settings and never shown here. */
export function PaymentStatusPanel() {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/payment-status", { cache: "no-store" }).then(async response => {
      const data = await response.json().catch(() => ({})) as Partial<PaymentStatus> & { error?: string };
      if (!response.ok || !data.mode) throw new Error(data.error || "Payment status is unavailable right now.");
      if (active) setStatus(data as PaymentStatus);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Payment status is unavailable right now."); });
    return () => { active = false; };
  }, []);
  const summary = status && describe(status);
  return <section className="panel settings-card" aria-labelledby="payment-status-title">
    <div className="panel-head"><div><p className="overline">PAYMENTS</p><h2 id="payment-status-title">Razorpay status</h2></div>{summary && <StatusChip tone={summary.tone}>{summary.chip}</StatusChip>}</div>
    {error && <p className="order-detail-error" role="alert">{error}</p>}
    {!status || !summary ? !error && <p className="muted">Checking payment status…</p> : <>
      <p className="muted">{summary.detail}</p>
      <dl className="payment-status-list">
        <div><dt>Customer checkout</dt><dd>{!status.checkoutOpen ? "Can't take payments" : status.mode === "live" ? "Taking real payments" : "Open for test payments"}</dd></div>
        <div><dt>Automatic payment updates</dt><dd>{status.webhookSet ? "Set up" : "Not set up"}<small>{status.webhookSet ? "Razorpay can tell the shop about a payment directly." : "If a customer closes the page right after paying, the order can stay unconfirmed until it's checked again."}</small></dd></div>
      </dl>
      <small className="field-hint">This is read-only. Razorpay keys are kept in the server's settings and are never shown here.</small>
    </>}
  </section>;
}
