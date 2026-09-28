import { messageAuthor, messageText, typingFor, type Author, type ChatMessage, type DeployCard, type Person } from "@pitwall/scenarios";
import { fillWorld, type World } from "@pitwall/world";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { useNow } from "../../useNow";
import "./chat.css";
import { avatarIndex, dayLabel, groupHeads, initials, relative, sameDay } from "./model";
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

function DeployCardView({ card, world }: { card: DeployCard; world: World }) {
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
    </div>
  );
}

export function ChatApp() {
  const incident = useIncident();
  const { read, markRead, bootAt, arrivals } = useOs();
  const { world, scenario, content, inspect, snapshot } = incident;
  const now = useNow().getTime();
  const visible = visibleFor(incident);

  const atOf = (m: ChatMessage) => (m.minutesAgo !== undefined ? bootAt - m.minutesAgo * MINUTE : (arrivals.get(m.id) ?? now));
  const inChannel = (ch: string) => visible.filter((m) => m.channel === ch).sort((a, b) => atOf(a) - atOf(b));
  const firstUnread = (ch: string) => inChannel(ch).find((m) => !read.has(m.id))?.id ?? null;

  const [current, setCurrent] = useState(content.channels[0]!);
  const [mark, setMark] = useState<string | null>(() => firstUnread(content.channels[0]!));
  const [sent, setSent] = useState<Record<string, Item[]>>({});
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useState<ReadonlySet<string>>(() => new Set());
  const [threadId, setThreadId] = useState<string | null>(null);

  const messages = inChannel(current);
  const ids = messages.map((m) => m.id).join(",");

  useEffect(() => {
    if (messages.length === 0) return;
    markRead(messages.map((m) => m.id));
    for (const m of messages) if ("hotspotId" in m) inspect(m.hotspotId);
    // Re-run when the channel or its visible messages change.
  }, [current, ids]);

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
    ...(sent[current] ?? []),
  ].sort((a, b) => a.at - b.at);
  const heads = groupHeads(items);
  const label = channelLabel(current, world);
  const dm = current.startsWith("dm:") ? (current.slice(3) as Person) : null;
  const info = dm ? null : content.channelInfo[current];
  const typing = typingFor(content, snapshot.busy?.actionId ?? null).filter((t) => t.channel === current);
  const thread = items.find((i) => i.id === threadId && i.msg?.thread);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const at = Date.now();
    setSent((s) => ({ ...s, [current]: [...(s[current] ?? []), { id: `you-${at}-${(s[current] ?? []).length}`, author: "you", name: "You", text, at }] }));
    setDraft("");
  };

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
          <ol className="chat-log" aria-label={`Messages in ${label}`}>
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
                  <li className={head ? "msg head" : "msg"}>
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
                      {it.msg?.card && <DeployCardView card={it.msg.card} world={world} />}
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
            }}
          />
          <button type="submit" className="btn primary" disabled={!draft.trim()}>
            Send
          </button>
          <p className="composer-hint">Enter to send · Shift + Enter for a new line</p>
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
                <li key={i} className="msg head">
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
