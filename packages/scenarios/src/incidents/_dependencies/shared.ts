import type { ChannelInfo, RequestPattern } from "../../desktop";

/** The workspace's channels, shared by the dependency incidents so they feel like one company. */
export const CHANNELS = ["incidents", "deploys", "infra", "support"] as const;

export const CHANNEL_INFO: Record<string, ChannelInfo> = {
  incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
  deploys: { topic: "Production deploy notifications from Deploy Bot", members: 52, pinned: 1 },
  infra: { topic: "Databases, networking and platform maintenance notices", members: 24, pinned: 5 },
  support: { topic: "Customer reports and escalations from the support desk", members: 17, pinned: 2 },
};

/** The storefront's requests, with one path that fails while the incident lasts. */
export function storefrontRequests(failing: { method: "GET" | "POST"; path: string; failMs: readonly [number, number]; okMs: readonly [number, number] }): RequestPattern[] {
  return [
    { method: "GET", path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] },
    { method: "GET", path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] },
    { method: "GET", path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] },
    { method: "GET", path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] },
    { method: "GET", path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] },
    { method: "POST", path: "/cart", type: "fetch", initiator: "app.js", weight: 2, okStatus: 201, failsWithSymptom: false, okMs: [60, 140], failMs: [60, 140] },
    { ...failing, type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: true },
  ];
}
