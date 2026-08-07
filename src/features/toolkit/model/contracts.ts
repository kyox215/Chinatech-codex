export type ToolkitResourceKind = "file" | "link";
export type ToolkitResourceState = "draft" | "published" | "archived";
export type ToolkitUploadState = "not_applicable" | "pending" | "ready" | "quarantined";
export type ToolkitSecurityReviewState = "not_required" | "pending" | "clean";

export interface ToolkitResource {
  id: string;
  kind: ToolkitResourceKind;
  state?: ToolkitResourceState;
  title: string;
  description: string;
  platform: string;
  version: string;
  displayFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  targetUrl?: string;
  uploadState?: ToolkitUploadState;
  securityReviewState?: ToolkitSecurityReviewState;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ToolkitListResult {
  resources: ToolkitResource[];
  canManage: boolean;
  unscannedFilesBlocked: boolean;
}

export interface ToolkitLinkCreateInput {
  title: string;
  description?: string;
  platform?: string;
  version?: string;
  url: string;
}

export interface ToolkitFilePrepareInput {
  title: string;
  description?: string;
  platform?: string;
  version?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ToolkitUploadIntent {
  path: string;
  token: string;
  expiresAt: string;
}

export interface ToolkitFilePrepareResult {
  resource: ToolkitResource;
  upload: ToolkitUploadIntent;
}

export interface ToolkitFileFinalizeInput {
  expectedRevision: number;
}

export interface ToolkitResourceUpdateInput {
  expectedRevision: number;
  title?: string;
  description?: string;
  platform?: string;
  version?: string;
  url?: string;
  provenanceNote?: string;
  trustAttestation?: boolean;
}

export type ToolkitResourceStatusAction = "publish" | "archive" | "restore";

export interface ToolkitResourceStatusInput {
  expectedRevision: number;
  action: ToolkitResourceStatusAction;
  provenanceNote?: string;
  trustAttestation?: boolean;
}

export interface ToolkitAccessResult {
  kind: ToolkitResourceKind;
  url: string;
  expiresAt?: string;
  fileName?: string;
}
