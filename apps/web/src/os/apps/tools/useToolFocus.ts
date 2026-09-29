import { useEffect, useState } from "react";
import { useOs } from "../../shell/OsContext";
import type { ToolAppId } from "./toolActions";

/** The service a tool shows (null for all), following Open in links while the tool is open. */
export function useToolFocus(app: ToolAppId): [string | null, (serviceId: string | null) => void] {
  const { toolFocus } = useOs();
  const mine = toolFocus?.app === app ? toolFocus : null;
  const [service, setService] = useState<string | null>(mine?.serviceId ?? null);
  useEffect(() => {
    if (mine) setService(mine.serviceId);
    // A new request (nonce) re-applies, even for the same service.
  }, [mine?.nonce]);
  return [service, setService];
}
