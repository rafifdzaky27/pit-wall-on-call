import type { FileKind } from "../../../content/files";

/** File-type icons, as in Nautilus. Functional: they tell folders, documents, data and images apart. */
export function FileIcon({ kind, size = 20 }: { kind: FileKind | "folder"; size?: number }) {
  const shape =
    kind === "folder" ? (
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l1.8 1.8h9.2A1.5 1.5 0 0 1 21 9.3v8.2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" className="fi-folder" />
    ) : kind === "image" ? (
      <>
        <rect x="4" y="5" width="16" height="14" rx="1.5" className="fi-image" />
        <path d="M6 16.5l4-4.5 3 3 2-2 3 3.5z" className="fi-mark" />
      </>
    ) : (
      <>
        <path d="M6 3.5h8l4 4v13H6z" className="fi-doc" />
        <path d={kind === "json" || kind === "yaml" || kind === "sql" ? "M10 11l-1.8 2 1.8 2M14 11l1.8 2-1.8 2" : "M8.5 11h7M8.5 13.5h7M8.5 16h4.5"} className="fi-lines" />
      </>
    );
  return (
    <svg className="file-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {shape}
    </svg>
  );
}
