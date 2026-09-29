import { messageAuthor, messageText, typingFor, type Author, type ChatMessage, type DeployCard, type Person } from "@pitwall/scenarios";
import { fillWorld, type World } from "@pitwall/world";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { useNow } from "../../useNow";
import "./chat.css";
import { avatarIndex, dayLabel, groupHeads, initials, relative, sameDay } from "./model";
import { useTeamActions } from "../../incident/useTeamActions";
import { complete, HELP_LINES, parseCommand } from "./commands";
import { authorName, channelLabel, isBot, isMention, visibleFor } from "./unread";

const PEOPLE: readonly Person[] = ["secondary", "deployer", "infra", "support"];
/** The deployer shipped and went home (their message says so); everyone else is at their desk. */
const PRESENCE: Record<Person, "active" | "away"> = { deployer: "away", secondary: "active", infra: "active", support: "active" };
const MINUTE = 60_000;
const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

interface Item {
  id: string;
  author: Author | "you";
  name: string;
  text: string;
  at: number;
  msg?: ChatMessage;
}

function Avatar({ name, bot = false, size = 36 }: { name: string; bot?: boolean; size?: number }) {
  return (
    <span className={bot ? "avatar bot" : "avatar"} style={{ background: `var(--avatar-${avatarIndex(name)})`, width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function DeployCardView({ card, world, onOpen }: { card: DeployCard; world: World; onOpen: (() => void) | null }) {
  return (
    <div className="deploy-card">
      <p className="deploy-title">
        <b>{card.service}</b> {card.version} → {card.env}
      </p>
      <dl>
        <dt>Commit</dt>
        <dd className="mono">{card.sha}</dd>
        <dt>By</dt>
        <dd>{world.colleagues[card.by]}</dd>
        <dt>Changes</dt>
        <dd>{card.changes}</dd>
        <dt>Status</dt>
        <dd>
          <span className={`tag ${card.status === "succeeded" ? "ok" : "crit"}`}>{card.status === "succeeded" ? "Succeeded" : "Failed"}</span>
        </dd>
      </dl>
      {onOpen && (
        <button type="button" className="btn deploy-open" onClick={onOpen}>
          Open in Deploys
        </button>
      )}
    </div>
  );
}

export function ChatApp() {
  const incident = useIncident();
  const { read, markRead, bootAt, arrivals, chatPosts, postChat, openTool, signal } = useOs();
  const team = useTeamActions();
  const { world, scenario, content, inspect, snapshot } = incident;
  const now = useNow().getTime();
  const visible = visibleFor(incident);

  const atOf = (m: ChatMessage) => (m.minutesAgo !== undefined ? bootAt - m.minutesAgo * MINUTE : (arrivals.get(m.id) ?? now));
  const inChannel = (ch: string) => visible.filter((m) => m.channel === ch).sort((a, b) => atOf(a) - atOf(b));
  const firstUnread = (ch: string) => inChannel(ch).find((m) => !read.has(m.id))?.id ?? null;

  const [current, setCurrent] = useState(content.channels[0]!);
  const [mark, setMark] = useState<string | null>(() => firstUnread(content.channels[0]!));
  const [draft, setDraft] = useState("");
  useEffect(() => {
    signal(`chat:${current}`);
  }, [current, signal]);
  const [mine, setMine] = useState<ReadonlySet<string>>(() => new Set());
  const [threadId, setThreadId] = useState<string | null>(null);
  /** An ephemeral line above the composer: /help, or why a command could not run. */
  const [note, setNote] = useState<string | null>(null);
  const replyTimers = useRef<number[]>([]);
  useEffect(() => () => replyTimers.current.forEach((id) => window.clearTimeout(id)), []);

  const log = useRef<HTMLOListElement>(null);
  const shownIn = useRef<string | null>(null);
  const messages = inChannel(current);
  const ids = messages.map((m) => m.id).join(",");

  useEffect(() => {
    if (messages.length === 0) return;
    markRead(messages.map((m) => m.id));
    for (const m of messages) if ("hotspotId" in m) inspect(m.hotspotId);
    // Re-run when the channel or its visible messages change.
  }, [current, ids]);

  // Like Slack: a channel opens at its first unread message, otherwise at the newest; new
  // messages in the open channel keep it scrolled to the bottom.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const opened = shownIn.current !== current;
    shownIn.current = current;
    const marker = opened ? el.querySelector<HTMLElement>(".chat-new") : null;
    // scrollIntoView would also scroll the overflow-hidden PitOS root (M1.6 F1).
    if (marker) el.scrollTop += marker.getBoundingClientRect().top - el.getBoundingClientRect().top;
    else el.scrollTop = el.scrollHeight;
  }, [current, messages.length]);

  const select = (ch: string) => {
    setMark(firstUnread(ch));
    setCurrent(ch);
    setThreadId(null);
    setDraft("");
  };

  const items: Item[] = [
    ...messages.map((m) => {
      const author = messageAuthor(m, scenario);
      return { id: m.id, author, name: authorName(author, world), text: fillWorld(messageText(m, scenario), world), at: atOf(m), msg: m };
    }),
    ...chatPosts.filter((p) => p.channel === current).map((p) => ({ ...p, name: p.author === "you" ? "You" : authorName(p.author, world) })),
  ].sort((a, b) => a.at - b.at);
  const heads = groupHeads(items);
  const label = channelLabel(current, world);
  const dm = current.startsWith("dm:") ? (current.slice(3) as Person) : null;
  const info = dm ? null : content.channelInfo[current];
  const running = [...(snapshot.busy ? [snapshot.busy.actionId] : []), ...snapshot.pending.map((p) => p.actionId)];
  const typing = typingFor(content, running).filter((t) => t.channel === current);
  const thread = items.find((i) => i.id === threadId && i.msg?.thread);

  /** A teammate question from a chip or /ask: your message goes to their DM, then they answer. */
  const ask = (actionId: string): boolean => {
    const def = scenario.actions.find((a) => a.id === actionId)!;
    const why = team.ask(actionId);
    if (why) {
      setNote(why);
      return false;
    }
    setNote(current === `dm:${def.ask!.to}` ? null : `Asked ${world.colleagues[def.ask!.to as Person]} in a direct message.`);
    return true;
  };

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const cmd = parseCommand(text, { scenario, world });
    if (cmd.kind === "help") {
      setNote(HELP_LINES.join("\n"));
      setDraft("");
      return;
    }
    if (cmd.kind === "error") {
      setNote(cmd.message);
      return;
    }
    if (cmd.kind === "ask") {
      if (ask(cmd.actionId)) setDraft("");
      return;
    }
    if (cmd.kind === "status" || cmd.kind === "page") {
      const why = cmd.kind === "status" ? team.postStatus(cmd.text) : team.pageSecondary();
      if (why) {
        setNote(why);
        return;
      }
      setNote(null);
      setDraft("");
      return;
    }
    postChat(current, "you", text);
    setDraft("");
    setNote(null);
    // Teammates only answer what they can; free text gets an honest reply (M2.5 plan B5).
    if (dm) {
      const who = dm;
      const channel = current;
      replyTimers.current.push(window.setTimeout(() => postChat(channel, who, "Not sure what you mean. Try /help, or one of the suggestions below."), 5000));
    }
  };

  /** Open in Deploys, for a card about a service in this incident. */
  const deployTarget = (card: DeployCard) => {
    const svc = scenario.services.find((s) => s.label === card.service);
    return svc ? () => openTool("deploys", svc.id) : null;
  };

  const asked = (actionId: string) => incident.timeline.some((e) => e.kind === "action_start" && e.actionId === actionId);
  const chips = dm ? scenario.actions.filter((a) => a.ask?.to === dm && !asked(a.id)) : [];

  const toggleReaction = (key: string) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const channelButton = (ch: string, text: string, extra?: string) => {
    const unread = visible.filter((m) => m.channel === ch && !read.has(m.id)).length;
    const name = [text, extra, unread ? `${unread} unread` : null].filter(Boolean).join(", ");
    return (
      <li key={ch}>
        <button type="button" className={`chat-channel${ch === current ? " current" : ""}${unread ? " unread" : ""}`} aria-pressed={ch === current} aria-label={name} onClick={() => select(ch)}>
          {ch.startsWith("dm:") ? <span className={`presence ${extra}`} aria-hidden="true" /> : <span className="hash" aria-hidden="true">#</span>}
          <span className="chat-channel-name">{ch.startsWith("dm:") ? text : ch}</span>
          {unread > 0 && isMention(ch) && (
            <span className="chat-count" aria-hidden="true">
              {unread}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className={thread ? "chat with-thread" : "chat"}>
      <aside className="chat-side">
        <header className="chat-ws">
          <b>{world.brand.name}</b>
          <span className="chat-me">
            <span className="presence active" aria-hidden="true" /> You
          </span>
        </header>
        <nav aria-label="Channels">
          <h2 className="chat-sec">Channels</h2>
          <ul>{content.channels.map((ch) => channelButton(ch, `# ${ch}`))}</ul>
          <h2 className="chat-sec">Direct messages</h2>
          <ul>{PEOPLE.map((p) => channelButton(`dm:${p}`, world.colleagues[p], PRESENCE[p]))}</ul>
          <h2 className="chat-sec">Apps</h2>
          <ul className="chat-apps">
            {["PitBot", "Deploy Bot"].map((name) => (
              <li key={name}>
                <Avatar name={name} bot size={18} />
                {name}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <section className="chat-main" aria-labelledby="chat-h">
        <header className="chat-head">
          <h2 id="chat-h">{label}</h2>
          {info && <p className="chat-topic">{info.topic}</p>}
          {dm && <p className="chat-topic">{PRESENCE[dm] === "active" ? "Active" : "Away"}</p>}
          {info && (
            <p className="chat-stats">
              <span>{info.members} members</span>
              <span>{info.pinned} pinned</span>
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <p className="chat-empty">{dm ? `This is the very beginning of your direct message history with ${world.colleagues[dm]}.` : `This is the very beginning of #${current}.`}</p>
        ) : (
          <ol ref={log} className="chat-log" aria-label={`Messages in ${label}`}>
            {items.map((it, i) => {
              const head = heads.has(it.id);
              const bot = it.author !== "you" && isBot(it.author);
              const prev = items[i - 1];
              const replies = it.msg?.thread;
              const last = replies?.at(-1);
              return (
                <Fragment key={it.id}>
                  {(!prev || !sameDay(prev.at, it.at)) && (
                    <li className="chat-day">
                      <span>{dayLabel(it.at, now)}</span>
                    </li>
                  )}
                  {it.id === mark && (
                    <li className="chat-new">
                      <span>New messages</span>
                    </li>
                  )}
                  <li className={head ? "chat-msg head" : "chat-msg"}>
                    <div className="msg-gutter">
                      {head ? (
                        <Avatar name={it.name} bot={bot} />
                      ) : (
                        <time className="msg-hover-time" dateTime={new Date(it.at).toISOString()}>
                          {clock.format(it.at)}
                        </time>
                      )}
                    </div>
                    <div className="msg-body">
                      {head ? (
                        <p className="msg-meta">
                          <b>{it.name}</b>
                          {bot && <span className="app-badge">APP</span>}
                          <time dateTime={new Date(it.at).toISOString()}>{clock.format(it.at)}</time>
                        </p>
                      ) : (
                        <span className="visually-hidden">{it.name}</span>
                      )}
                      <p className="msg-text">{it.text}</p>
                      {it.msg?.code && <pre className="msg-code">{it.msg.code}</pre>}
                      {it.msg?.card && <DeployCardView card={it.msg.card} world={world} onOpen={deployTarget(it.msg.card)} />}
                      {it.msg?.reactions && (
                        <div className="reactions">
                          {it.msg.reactions.map((r) => {
                            const key = `${it.id}|${r.emoji}`;
                            const on = mine.has(key);
                            const names = [...r.by.map((a) => authorName(a, world)), ...(on ? ["you"] : [])];
                            return (
                              <button
                                key={key}
                                type="button"
                                className="reaction"
                                aria-pressed={on}
                                aria-label={`${r.emoji} ${names.length}, reacted by ${names.join(", ")}`}
                                title={names.join(", ")}
                                onClick={() => toggleReaction(key)}
                              >
                                <span aria-hidden="true">{r.emoji}</span>
                                <span className="mono">{names.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {replies && last && (
                        <button type="button" className="thread-link" onClick={() => setThreadId(it.id)}>
                          <b>{replies.length} replies</b>
                          <span>Last reply {relative(bootAt - last.minutesAgo * MINUTE, now)}</span>
                        </button>
                      )}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}

        <p className="chat-typing" aria-live="polite">
          {typing.length > 0 ? `${authorName(typing[0]!.author, world)} is typing…` : ""}
        </p>
        {chips.length > 0 && (
          <div className="chat-chips" role="group" aria-label="Suggested questions">
            {chips.map((a) => (
              <button key={a.id} type="button" className="chat-chip" onClick={() => ask(a.id)}>
                {a.ask!.prompt}
              </button>
            ))}
          </div>
        )}
        {current === "incidents" && (
          <div className="chat-chips" role="group" aria-label="Suggested actions">
            <button type="button" className="chat-chip" onClick={() => setDraft("/status ")}>
              Write a status update…
            </button>
            <button type="button" className="chat-chip" onClick={() => setDraft("/page @secondary")}>
              Page my secondary
            </button>
          </div>
        )}
        {note && (
          <p className="chat-note" role="status" aria-label="Chat note">
            {note}
          </p>
        )}
        <form className="composer" onSubmit={send}>
          <textarea
            aria-label={`Message ${label}`}
            placeholder={`Message ${label}`}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
              // Tab completes while there is something to add; otherwise it moves focus on (review I1).
              if (e.key === "Tab" && !e.shiftKey && draft.startsWith("/")) {
                const next = complete(draft, { scenario, world });
                if (next && next !== draft) {
                  e.preventDefault();
                  setDraft(next);
                }
              }
            }}
          />
          <button type="submit" className="btn primary" disabled={!draft.trim()}>
            Send
          </button>
          <p className="composer-hint">Enter to send · / for commands (Tab completes) · /help</p>
        </form>
      </section>

      {thread && thread.msg?.thread && (
        <aside className="chat-thread" aria-label="Thread">
          <header className="chat-thread-head">
            <h3>Thread</h3>
            <span className="muted">{label}</span>
            <button type="button" className="icon-btn" aria-label="Close thread" onClick={() => setThreadId(null)}>
              <Glyph name="close" />
            </button>
          </header>
          <ol className="chat-log">
            {[{ author: thread.author, name: thread.name, text: thread.text, at: thread.at }, ...thread.msg.thread.map((r) => ({ author: r.author, name: authorName(r.author, world), text: fillWorld(r.text, world), at: bootAt - r.minutesAgo * MINUTE }))].map(
              (r, i) => (
                <li key={i} className="chat-msg head">
                  <div className="msg-gutter">
                    <Avatar name={r.name} bot={r.author !== "you" && isBot(r.author)} />
                  </div>
                  <div className="msg-body">
                    <p className="msg-meta">
                      <b>{r.name}</b>
                      <time dateTime={new Date(r.at).toISOString()}>{clock.format(r.at)}</time>
                    </p>
                    <p className="msg-text">{r.text}</p>
                  </div>
                </li>
              ),
            )}
          </ol>
        </aside>
      )}
    </div>
  );
}
