import { useEffect, useState } from "react";
import type { default as PusherClient } from "pusher-js";

// The dashboard's live connection. It stays open while a tab is open, even hidden, so a new order
// can still play its sound. It's owner-only, so it stays a handful of connections.
export type OwnerTopic = "orders" | "products" | "store" | "coupons" | "settings" | "inquiries";
const OWNER_CHANNEL = "private-owner";
const TOPICS: OwnerTopic[] = ["orders", "products", "store", "coupons", "settings", "inquiries"];

let pusher: PusherClient | null = null;
let starting: Promise<PusherClient | null> | null = null;
const listeners = new Map<OwnerTopic, Set<() => void>>(TOPICS.map(topic => [topic, new Set()]));
const fire = (topic: OwnerTopic) => listeners.get(topic)?.forEach(listener => listener());

export const isLiveConnected = () => pusher?.connection.state === "connected";

function start() {
  starting ??= (async () => {
    const response = await fetch("/api/realtime/config", { cache: "no-store" });
    const config = await response.json() as { key: string | null; cluster: string | null };
    if (!config.key || !config.cluster) return null;
    const { default: Pusher } = await import("pusher-js");
    pusher = new Pusher(config.key, { cluster: config.cluster, channelAuthorization: { endpoint: "/api/realtime/auth/owner", transport: "ajax" } });
    const channel = pusher.subscribe(OWNER_CHANNEL);
    TOPICS.forEach(topic => channel.bind(topic, () => fire(topic)));
    // Signals sent while the connection was down are gone, so every reconnect reloads everything.
    let first = true;
    pusher.connection.bind("connected", () => { if (!first) TOPICS.forEach(fire); first = false; });
    return pusher;
  })().catch(() => null);
  return starting;
}

export function stopLive() {
  pusher?.disconnect();
  pusher = null;
  starting = null;
}

/** Goes up by one each time `topic` is signalled. Views reload when it changes. */
export function useLiveRevision(enabled: boolean, ...topics: OwnerTopic[]) {
  const [revision, setRevision] = useState(0);
  const key = topics.join();
  useEffect(() => {
    if (!enabled) return;
    void start();
    const bump = () => setRevision(current => current + 1);
    const names = key.split(",") as OwnerTopic[];
    names.forEach(topic => listeners.get(topic)?.add(bump));
    return () => names.forEach(topic => listeners.get(topic)?.delete(bump));
  }, [enabled, key]);
  return revision;
}
