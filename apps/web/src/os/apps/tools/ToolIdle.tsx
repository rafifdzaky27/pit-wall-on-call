/** A tool before the page: production is calm, and there is nothing to look at yet. */
export function ToolIdle({ name }: { name: string }) {
  return (
    <div className="app-pad">
      <span className="tag ok">All systems normal</span>
      <p className="muted">{name} fills in once the pager goes off.</p>
    </div>
  );
}
