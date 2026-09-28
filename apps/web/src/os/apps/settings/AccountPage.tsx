import { useState, type FormEvent } from "react";
import { ApiError, renamePlayer } from "../../../net/client";
import { forgetPlayer, HANDLE_RE, savePlayer, usePlayer, type StoredPlayer } from "../../../net/player";
import { Group, Row } from "./rows";

type Status = "saving" | "saved" | "invalid" | "rejected" | "failed" | null;

const MESSAGE: Record<Exclude<Status, null>, string> = {
  saving: "Saving…",
  saved: "Saved.",
  invalid: "Use 3 to 20 letters, numbers, - or _.",
  rejected: "Pick a different handle.",
  failed: "Couldn't save. Try again.",
};

function Rename({ player }: { player: StoredPlayer }) {
  const [value, setValue] = useState(player.handle);
  const [status, setStatus] = useState<Status>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const handle = value.trim();
    if (!HANDLE_RE.test(handle)) {
      setStatus("invalid");
      return;
    }
    setStatus("saving");
    try {
      const renamed = await renamePlayer(player.token, handle);
      savePlayer({ ...player, handle: renamed.handle });
      setValue(renamed.handle);
      setStatus("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The server no longer knows this token; the next posted shift asks for a handle again.
        forgetPlayer();
        return;
      }
      setStatus(error instanceof ApiError && error.status === 400 ? "rejected" : "failed");
    }
  };

  return (
    <form className="account-rename" onSubmit={save} noValidate>
      <input
        className="text-input mono"
        aria-label="Handle"
        aria-invalid={status === "invalid" || status === "rejected"}
        maxLength={40}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus(null);
        }}
      />
      <button type="submit" className="btn" disabled={status === "saving"}>
        Save
      </button>
      {status && (
        <span role="status" className={status === "saved" || status === "saving" ? "field-hint" : "field-hint error"}>
          {MESSAGE[status]}
        </span>
      )}
    </form>
  );
}

/** Settings → Account: the leaderboard handle on this device (M2 spec §6). */
export function AccountPage() {
  const player = usePlayer();
  if (!player) {
    return (
      <Group title="Leaderboard">
        <Row title="Handle" subtitle="You have no leaderboard handle yet. Finish a shift and post it from its postmortem." />
      </Group>
    );
  }
  return (
    <Group title="Leaderboard">
      <Row title="Shown as" subtitle="Your handle and tag on the practice leaderboard">
        <span className="mono">{`${player.handle}#${player.tag}`}</span>
      </Row>
      <Row title="Change handle" subtitle="3 to 20 letters, numbers, - or _.">
        <Rename key={player.playerId} player={player} />
      </Row>
      <Row title="Remove from this device" subtitle="Your posted shifts stay on the leaderboard.">
        <button type="button" className="btn" onClick={forgetPlayer}>
          Remove from this device
        </button>
      </Row>
    </Group>
  );
}
