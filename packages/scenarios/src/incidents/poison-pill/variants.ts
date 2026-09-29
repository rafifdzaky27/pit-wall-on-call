import type { Variant } from "./scenario";

const emailLike = (r: { int(n: number): number }) => `${100_000 + r.int(900_000)}`;

/** Order confirmations: RabbitMQ, a mailer, and a gift note with bytes no decoder accepts. Customers get a 503 on the order page. */
export const confirmations: Variant = {
  key: "",
  title: "The Poison Pill",
  summary: "Order confirmations stopped and the queue keeps growing. Is the mailer slow, or is it not moving at all?",
  symptom: { kind: "http_503", surface: "order status" },
  page: { severity: "SEV2", title: "Order status page returning 503", body: "Customers of {brand} cannot see their order status and confirmations are not going out. You are the primary on-call." },
  labels: { edge: "edge-gateway", api: "orders-api", queue: "order-confirmations", consumer: "mailer-worker", partner: "email-provider" },
  queueCard: "RabbitMQ",
  consumerVersion: "v56",
  consumerPrevVersion: "v55",
  ref: (n) => `msg-${n.toString(16)}`,
  field: { name: "gift_note", problem: "is not valid UTF-8" },
  edgeLine: (r) => `GET /orders/${emailLike(r)}/status 503, upstream "orders-api:8080" said confirmation not ready, client 10.0.${r.int(256)}.${r.int(256)}`,
  apiLine: (r) => `order ${emailLike(r)}: confirmation still pending after 3000 ms, answering 503`,
  consumerOk: (r) => `confirmation for order ${emailLike(r)} sent, provider 202 in ${150 + r.int(60)} ms`,
  partnerOk: (r) => `POST /v3/send 202 ${140 + r.int(70)}ms`,
  partnerStatus: "email-provider status page",
  peekCommand: "rabbitmqadmin get queue=order-confirmations ackmode=ack_requeue_true count=1",
  moveCommand: "rabbitmqadmin dead-letter --queue order-confirmations --message-id <id from the crash log>",
  purgeCommand: "rabbitmqctl purge_queue order-confirmations",
  deployReveal: `mailer-worker v56 by {deployer}, 3 h ago: "bump SMTP client to 3.1"; it sent confirmations without trouble for hours afterwards. v55 ran 12 days`,
  asks: {
    deployer: "v56 is just the SMTP client bump. It ran fine for hours after I shipped it, so I'd look somewhere else.",
    infra: "the queue is backed up because the email provider is slow, I'm fairly sure. Restart the workers and it should clear. Broker CPU is fine.",
    support: "customers just see a 503 on their order page. The first ticket came about 45 minutes ago from someone whose order had a gift note pasted in from another app, and everything after it is waiting too.",
    secondary: "the workers restart every 30 s and the queue is not draining at all. That looks like something blocking the front, not a slow provider.",
  },
  hotspots: {
    "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "the mailer-worker pods have been restarting on and off for the last hour, no idea why yet" },
    "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "mailer-worker v56 is out, just the SMTP client bump. Heading to lunch" },
    "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} ordered 40 min ago, no confirmation email and the order page says 503??", appearsAt: "incident_start" },
    "table.neighbours": { kind: "clue", label: "The next table", text: "I keep refreshing my order and it just says service unavailable." },
    "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand}: FREE SHIPPING THIS WEEKEND" },
  },
  lessons: {
    dnf: "One message with a malformed gift_note sat at the head of order-confirmations and crashed every consumer that picked it up. The queue was not slow, it was blocked. The crash logs name the message; setting it aside unblocks everything behind it.",
    purge: "Purging the queue threw away every valid confirmation, and the publisher sent the bad message again. Set the one bad message aside instead of dropping the whole queue.",
    restart: "Restarting the consumers bought time: they drained the queue until they reached the bad message again. When the same crash repeats, look for what it is choking on.",
    default: "A backlog that will not drain is not always a capacity problem. One message the consumers cannot parse can block a whole queue. The crash logs name it, and a dead-letter queue is where it belongs.",
  },
  hints: [
    "Is the queue slow, or is it not moving at all?",
    "When a consumer crashes on the same delivery again and again, what does that say about the message it is holding?",
    "If restarting made it better for a while, why did it come back?",
  ],
};

/** Inventory reservations: Kafka, one partition stuck on a line with a negative quantity, and checkout falling back to a slow synchronous call. */
export const reservations: Variant = {
  key: "inventory",
  title: "The Poison Pill: Stuck Reservations",
  summary: "Checkout fails for some customers and stock reservations are piling up. Why is one partition not moving?",
  symptom: { kind: "http_500", surface: "checkout" },
  page: { severity: "SEV2", title: "Checkout returning 500", body: "Checkout for {brand} fails for a share of customers while stock reservations pile up. You are the primary on-call." },
  labels: { edge: "edge-gateway", api: "checkout-api", queue: "inventory.reservations", consumer: "inventory-worker", partner: "warehouse-api" },
  queueCard: "Kafka · 6 partitions",
  consumerVersion: "v92",
  consumerPrevVersion: "v91",
  ref: (n) => `partition 3, offset ${1_842_000 + (n % 9000)}`,
  field: { name: "quantity", problem: "is -1, which the reservation validator rejects" },
  edgeLine: (r) => `POST /checkout 500 5001ms, upstream "checkout-api:8080" timed out reserving stock, client 10.0.${r.int(256)}.${r.int(256)}`,
  apiLine: (r) => `cart ${emailLike(r)}: reservation not confirmed within 4000 ms, the synchronous fallback timed out`,
  consumerOk: (r) => `reserved ${1 + r.int(4)} units for order ${emailLike(r)}, offset committed`,
  partnerOk: (r) => `POST /v2/stock/sync 200 ${120 + r.int(80)}ms`,
  partnerStatus: "warehouse-api status page",
  peekCommand: "kafka-consumer-groups.sh --bootstrap-server kafka-1:9092 --describe --group inventory-worker",
  moveCommand: "kafka-dlq move --topic inventory.reservations --partition <partition> --offset <offset from the crash log>",
  purgeCommand: "kafka-delete-records.sh --bootstrap-server kafka-1:9092 --offset-json-file all-partitions-to-end.json",
  deployReveal: `inventory-worker v92 by {deployer}, 3 h ago: "batch reservation writes, 50 per commit"; it committed batches cleanly for hours afterwards. v91 ran 9 days`,
  asks: {
    deployer: "v92 batches the reservation writes, 50 per commit. It has been fine since this afternoon, so I doubt it's the batching.",
    infra: "Kafka brokers are healthy. The lag is the warehouse API being slow, I'd bump the consumer count and let it catch up.",
    support: "customers get a 500 at the pay step, some of them and not others. The first person to write in uses our bulk-order API, and her import had an odd line item.",
    secondary: "the lag is not spread out, it is stuck on a single partition while the others move. That does not look like a load problem.",
  },
  hotspots: {
    "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "inventory-worker is in CrashLoopBackOff again. Been on and off for about 40 minutes" },
    "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "inventory-worker v92 is out: batched reservation writes, no schema change" },
    "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} checkout has thrown a 500 for half an hour, tried three times", appearsAt: "incident_start" },
    "table.neighbours": { kind: "clue", label: "The next table", text: "Mine went through and my friend's bulk order keeps failing at the pay step. Same site, same minute." },
    "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
  },
  lessons: {
    dnf: "One reservation with a quantity of -1 sat on a single partition and crashed the consumer each time it was delivered. Everything behind it waited, and checkout fell back to a slow synchronous call. The crash logs name the partition and offset; moving that one message aside unblocks the rest.",
    purge: "Deleting the records dropped every waiting reservation, and the producer re-sent the bad one. Move the single bad message to the dead-letter topic instead of wiping the partitions.",
    restart: "Restarting the consumers only worked until they reached the bad offset again. When the lag stays on one partition, look at the message at its head.",
    default: "Lag on one partition is a different problem from lag on all of them. A single message a consumer cannot process can stall everything behind it. Find it in the crash logs and set it aside.",
  },
  hints: [
    "Is the lag on every partition, or on one?",
    "What does the consumer do, each time, when it reaches the same offset?",
    "If skipping ahead is the fix, what do you lose by skipping too far?",
  ],
};

export const VARIANTS: readonly Variant[] = [confirmations, reservations];
