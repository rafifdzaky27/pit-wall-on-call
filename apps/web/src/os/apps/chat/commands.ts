import type { ScenarioDef, State } from "@pitwall/engine";
import type { World } from "@pitwall/world";

export type Command =
  | { kind: "ask"; actionId: string }
  | { kind: "status"; text: string }
  | { kind: "page" }
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "text" };

export interface CommandContext {
  scenario: ScenarioDef<State>;
  world: World;
}

export const PAGE_ACTION = "global.ask_secondary";
export const STATUS_ACTION = "global.status_update";

const COMMANDS = ["/ask", "/status", "/page", "/help"] as const;

export const HELP_LINES = [
  "/ask @name topic: ask a teammate (Tab completes names and topics)",
  "/status your words: post a status update for customers",
  "/page @secondary: page your secondary on-call",
  "/help: this list",
];

type Person = keyof World["colleagues"];

/** Teammates by lower-case first name and by role, so both "@dimas" and "@deployer" work. */
function people(world: World): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const [role, name] of Object.entries(world.colleagues) as [Person, string][]) {
    map.set(name.split(" ")[0]!.toLowerCase(), role);
    map.set(role, role);
  }
  return map;
}

function asks(scenario: ScenarioDef<State>, person: Person) {
  return scenario.actions.filter((a) => a.ask?.to === person);
}

/** Reads what the player typed (M2.5 spec §7). Anything without a leading slash is plain chat. */
export function parseCommand(input: string, { scenario, world }: CommandContext): Command {
  const text = input.trim();
  if (!text.startsWith("/")) return { kind: "text" };
  const [name = "", ...rest] = text.split(/\s+/);
  const args = rest.join(" ");
  switch (name.toLowerCase()) {
    case "/help":
      return { kind: "help" };
    case "/status":
      return args ? { kind: "status", text: args } : { kind: "error", message: "Write the update after /status, for example: /status Investigating checkout errors" };
    case "/page": {
      const who = people(world).get(args.replace(/^@/, "").toLowerCase());
      return who === "secondary" ? { kind: "page" } : { kind: "error", message: "Only your secondary can be paged: /page @secondary" };
    }
    case "/ask": {
      const [handle = "", topic = ""] = rest;
      const key = handle.replace(/^@/, "").toLowerCase();
      const who = people(world).get(key);
      if (!who) return { kind: "error", message: `No teammate called ${key || "…"}. Try /help.` };
      const options = asks(scenario, who);
      const hit = options.find((a) => a.ask!.topic === topic.toLowerCase());
      if (hit) return { kind: "ask", actionId: hit.id };
      if (options.length === 0) return { kind: "error", message: `${world.colleagues[who]} can't help with this incident.` };
      return { kind: "error", message: `Ask ${world.colleagues[who]} about: ${options.map((a) => a.ask!.topic).join(", ")}.` };
    }
    default:
      return { kind: "error", message: `Unknown command ${name}. Try /help.` };
  }
}

/** Tab completion: the next word of a command, a teammate's first name, or a topic. Null if nothing fits. */
export function complete(input: string, { scenario, world }: CommandContext): string | null {
  const parts = input.split(" ");
  if (parts.length === 1) {
    const hit = COMMANDS.find((c) => c.startsWith(parts[0]!.toLowerCase()) && c !== parts[0]);
    if (!hit) return null;
    return hit === "/ask" || hit === "/page" ? `${hit} @` : `${hit} `;
  }
  const [cmd, handle = "", topic] = parts;
  if (cmd !== "/ask" && cmd !== "/page") return null;
  const names = [...people(world).entries()].filter(([key, role]) => key !== role);
  if (topic === undefined) {
    const prefix = handle.replace(/^@/, "").toLowerCase();
    const hit = names.find(([key]) => key.startsWith(prefix));
    return hit ? `${cmd} @${hit[0]} ` : null;
  }
  if (cmd !== "/ask") return null;
  const who = people(world).get(handle.replace(/^@/, "").toLowerCase());
  if (!who) return null;
  const hit = asks(scenario, who).find((a) => a.ask!.topic.startsWith(topic.toLowerCase()));
  return hit ? `${cmd} ${handle} ${hit.ask!.topic}` : null;
}
