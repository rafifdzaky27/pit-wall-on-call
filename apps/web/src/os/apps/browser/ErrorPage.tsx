import { REASON } from "./http";

/** Server-default error pages: generic nginx, framework and CDN styles, no vendor branding (spec D20). */
export function ErrorPage({ code, server }: { code: number; server: "nginx" | "framework" | "cdn" }) {
  const reason = REASON[code] ?? "Error";
  if (server === "nginx") {
    return (
      <div className="errpage errpage-nginx">
        <h1>
          {code} {reason}
        </h1>
        <hr />
        <p>nginx</p>
      </div>
    );
  }
  if (server === "cdn") {
    return (
      <div className="errpage errpage-cdn">
        <p className="errpage-code">Error {code}</p>
        <h1>{reason}</h1>
        <p>The edge network could not complete your request. If this keeps happening, contact the site owner.</p>
      </div>
    );
  }
  return (
    <div className="errpage errpage-framework">
      <h1>{reason}</h1>
      <p>The server could not complete your request.</p>
      <p className="mono">HTTP {code}</p>
    </div>
  );
}
