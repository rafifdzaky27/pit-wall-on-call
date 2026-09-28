import { messageAuthor, messageText } from "@pitwall/scenarios";
import { fillWorld } from "@pitwall/world";
import { useEffect, useState } from "react";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { authorName, channelLabel, visibleFor } from "./unread";
import "./chat.css";

function when(minutesAgo: number | undefined): string {
  if (minutesAgo === undefined) return "just now";
  if (minutesAgo >= 1440) return `${Math.floor(minutesAgo / 1440)} d ago`;
  if (minutesAgo >= 60) return `${Math.floor(minutesAgo / 60)} h ago`;
  return `${minutesAgo} min ago`;
}

export function ChatApp() {
  const incident = useIncident();
  const { read, markRead } = useOs();
  const { world, scenario, content, inspect } = incident;
  const visible = visibleFor(incident);
  const dms = [...new Set(visible.filter((m) => m.channel.startsWith("dm:")).map((m) => m.channel))];
  const channels = [...content.channels, ...dms];
  const [current, setCurrent] = useState(content.channels[0]!);
  const inChannel = visible.filter((m) => m.channel === current);
  const ids = inChannel.map((m) => m.id).join(",");

  useEffect(() => {
    if (inChannel.length === 0) return;
    markRead(inChannel.map((m) => m.id));
    for (const m of inChannel) if ("hotspotId" in m) inspect(m.hotspotId);
    // Re-run when the channel or its visible messages change.
  }, [current, ids]);

  return (
    <div className="chat">
      <nav className="chat-side" aria-label="Channels">
        <h2 className="group-h">Channels</h2>
        <ul>
          {channels.map((ch) => {
            const unread = visible.filter((m) => m.channel === ch && !read.has(m.id)).length;
            const label = channelLabel(ch, world);
            return (
              <li key={ch}>
                <button
                  type="button"
                  className={`chat-channel${ch === current ? " current" : ""}${unread ? " unread" : ""}`}
                  aria-pressed={ch === current}
                  aria-label={unread ? `${label}, ${unread} unread` : label}
                  onClick={() => setCurrent(ch)}
                >
                  <span>{label}</span>
                  {unread > 0 && (
                    <span className="chat-count" aria-hidden="true">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <section className="chat-main" aria-labelledby="chat-h">
        <h2 id="chat-h" className="chat-title">
          {channelLabel(current, world)}
        </h2>
        {inChannel.length === 0 ? (
          <p className="empty chat-empty">No messages in {current.startsWith("dm:") ? channelLabel(current, world) : `#${current}`} yet.</p>
        ) : (
          <ol className="chat-messages">
            {inChannel.map((m) => (
              <li key={m.id} className="chat-msg">
                <div className="chat-meta">
                  <b>{authorName(messageAuthor(m, scenario), world)}</b>
                  <time>{when(m.minutesAgo)}</time>
                </div>
                <p>{fillWorld(messageText(m, scenario), world)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
