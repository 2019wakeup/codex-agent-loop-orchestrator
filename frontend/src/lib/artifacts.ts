import type { ArtifactEntryLike } from "../api/types";

export interface ArtifactFilters {
  search: string;
  kind: string;
  source: string;
  turn: string;
}

export function artifactRelativePath(value: unknown): string {
  if (!value) return "";
  const text = `${value}`;
  const marker = "/.codex/agent-loop/";
  const index = text.indexOf(marker);
  if (index === -1) return text;
  const rest = text.slice(index + marker.length);
  const parts = rest.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : rest;
}

export function filterArtifacts<T extends ArtifactEntryLike>(artifacts: readonly T[], filters: ArtifactFilters): T[] {
  const search = filters.search.trim().toLowerCase();
  return artifacts.filter((artifact) => {
    const searchable = [
      artifact.path,
      artifact.display_name,
      artifact.kind,
      artifact.source,
      artifact.role,
      artifact.turn_id,
      artifact.run_id
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!search || searchable.includes(search)) &&
      (filters.kind === "all" || artifact.kind === filters.kind) &&
      (filters.source === "all" || artifact.source === filters.source) &&
      (filters.turn === "all" || artifact.turn_id === filters.turn)
    );
  });
}

export function selectVisibleArtifact<T extends ArtifactEntryLike>(visible: readonly T[], selectedPath: string | null | undefined): T | null {
  return visible.find((artifact) => artifact.path === selectedPath) || visible[0] || null;
}
