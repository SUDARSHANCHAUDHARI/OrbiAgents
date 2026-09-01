import type { HireProfile, RemoteHireImportRequest } from "../../shared/contracts";
import type { RemoteCatalogClient } from "../catalog/remoteCatalogClient";
import { validateHireProfile } from "./hireProfileCodec";

export class RemoteHireGallery {
  constructor(private readonly catalogs: RemoteCatalogClient) {}

  async importProfile(input: unknown): Promise<HireProfile> {
    const request = parseRequest(input); const artifact = await this.catalogs.downloadReviewedArtifact(request.catalog, request.entryId);
    if (artifact.entry.kind !== "hire-profile") throw new Error("Only verified hire profiles can be imported here");
    let value: unknown; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(artifact.bytes)); } catch { throw new Error("Verified hire profile package is invalid JSON"); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Verified hire profile package is invalid"); const row = value as Record<string, unknown>;
    if (Object.keys(row).some((key) => !["schemaVersion", "id", "name", "description", "version", "profile"].includes(key)) || row.schemaVersion !== 1 || row.id !== artifact.entry.id || row.name !== artifact.entry.name || row.description !== artifact.entry.description || row.version !== artifact.entry.version) throw new Error("Verified hire profile metadata does not match the catalog");
    return validateHireProfile(row.profile);
  }
}

function parseRequest(value: unknown): RemoteHireImportRequest { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Remote hire import request is invalid"); const row = value as Record<string, unknown>; if (Object.keys(row).some((key) => !["catalog", "entryId"].includes(key)) || !row.catalog || typeof row.catalog !== "object" || typeof row.entryId !== "string" || row.entryId.length > 128) throw new Error("Remote hire import request is invalid"); return { catalog: row.catalog as RemoteHireImportRequest["catalog"], entryId: row.entryId }; }
