export type ArtifactKind = "source" | "build" | "test-report" | "log" | "preview" | "package" | "release-notes";

export interface ArtifactRecord {
  id: string;
  projectId: string;
  kind: ArtifactKind;
  location: string;
  producedBy: string;
  createdAt: string;
  checksum?: string;
  metadata?: Record<string, string>;
}

export class ArtifactRegistry {
  private readonly records: ArtifactRecord[] = [];

  add(record: ArtifactRecord): ArtifactRecord {
    if (!record.location || record.location.includes("..")) throw new Error("Unsafe artifact location");
    this.records.push(record);
    return record;
  }

  all(projectId?: string): ArtifactRecord[] {
    return this.records.filter((record) => !projectId || record.projectId === projectId);
  }

  hasKind(projectId: string, kind: ArtifactKind): boolean {
    return this.records.some((record) => record.projectId === projectId && record.kind === kind);
  }
}
