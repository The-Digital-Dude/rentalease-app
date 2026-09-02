import { AppState } from "react-native";
import { getToken } from "./secureStore";
import { BASE_URL } from "../config/api";

/**
 * `expo-file-system`'s legacy API, loaded lazily.
 *
 * `uploadAsync` with `sessionType: BACKGROUND` hands the upload to the OS
 * (NSURLSession background configuration on iOS, always-background on Android),
 * so a photo keeps uploading while the technician takes a call or switches
 * apps. That is the one thing a plain `fetch` cannot do: JavaScript is
 * suspended when the app leaves the foreground, and any `fetch` in flight dies
 * with it.
 *
 * Worth loading it defensively, in the same shape as the image-manipulator
 * accessor in InspectionForm: the module has shipped in every build since
 * before 1.0.14, but an update that assumes a native module and is wrong takes
 * out every install at once. If it is ever missing we fall back to the batched
 * `fetch` path, which still works — it just cannot survive backgrounding.
 */
let legacyFileSystem: any | null | undefined;
const getBackgroundUploader = () => {
  if (legacyFileSystem === undefined) {
    try {
      const mod = require("expo-file-system/legacy");
      legacyFileSystem =
        typeof mod?.uploadAsync === "function" &&
        mod?.FileSystemUploadType &&
        mod?.FileSystemSessionType
          ? mod
          : null;
    } catch {
      legacyFileSystem = null;
    }
    if (!legacyFileSystem) {
      console.warn(
        "[Inspection] Background upload unavailable — photos will upload in the foreground only."
      );
    }
  }
  return legacyFileSystem;
};

export type Job = {
  id: string;
  job_id: string;
  jobType: string;
  status:
    | "Available"
    | "Pending"
    | "Scheduled"
    | "In Progress"
    | "Active"
    | "Completed"
    | "Cancelled";
  priority: "Low" | "Medium" | "High" | "Critical" | "Urgent";
  title?: string;
  description: string;
  property: {
    address?:
      | {
          street: string;
          suburb: string;
          state: string;
          postcode: string;
          fullAddress: string;
        }
      | string;
    currentTenant?: {
      name: string;
      email: string;
      phone: string;
    };
    currentLandlord?: {
      name: string;
      email: string;
      phone: string;
    };
    propertyManager?: {
      name: string;
      email?: string;
      phone?: string;
    };
    assignedPropertyManager?: {
      name?: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    propertyType?: string;
    region?: string;
    agency?: {
      _id: string;
      companyName: string;
      contactPerson: string;
      email: string;
      phone: string;
    };
  };
  createdAt: string;
  dueDate: string;
  estimatedDuration?: number;
  cost?: {
    materialCost: number;
    laborCost: number;
    totalCost: number;
  };
  notes?: string;
  assignedTechnician?: any;
  isOverdue?: boolean;
  reportFile?: string | null;
  latestInspectionReport?: {
    id?: string;
    _id?: string;
    jobType?: string;
    submittedAt?: string;
    pdf?: {
      url?: string;
    } | null;
  } | null;
  inspectionReports?: Array<{
    id?: string;
    _id?: string;
    submittedAt?: string;
    pdf?: {
      url?: string;
    } | null;
  }>;
  hasInvoice?: boolean;
  invoice?: any;
  completedAt?: string;
  updatedAt?: string;
  shift?: "morning" | "afternoon" | "evening";
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
};

// Large inspection reports (80+ photos) can take several minutes end to end.
// Kept well above the server's own 15-minute request timeout margin so the
// server, not the client, decides when a submission has genuinely failed.
const INSPECTION_SUBMIT_TIMEOUT_MS = 10 * 60 * 1000;

const getFullName = (value: any): string => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  const direct =
    value.name ||
    value.fullName ||
    value.contactPerson ||
    value.companyName;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const first = typeof value.firstName === "string" ? value.firstName.trim() : "";
  const last = typeof value.lastName === "string" ? value.lastName.trim() : "";
  return `${first} ${last}`.trim();
};

export const getPropertyManagerName = (property?: Job["property"] | any) => {
  if (!property) return "N/A";

  const explicitManager =
    getFullName((property as any).propertyManager) ||
    getFullName((property as any).assignedPropertyManager);

  if (explicitManager) {
    return explicitManager;
  }

  return getFullName((property as any).agency) || "N/A";
};

export const getPropertyManagerEmail = (property?: Job["property"] | any) => {
  return (
    (property as any)?.propertyManager?.email ||
    (property as any)?.assignedPropertyManager?.email ||
    (property as any)?.agency?.email ||
    ""
  );
};

export const getPropertyManagerPhone = (property?: Job["property"] | any) => {
  return (
    (property as any)?.propertyManager?.phone ||
    (property as any)?.assignedPropertyManager?.phone ||
    (property as any)?.agency?.phone ||
    ""
  );
};

export const getAssignedTechnicianName = (jobOrTechnician?: Job | any) => {
  const technician =
    (jobOrTechnician as Job)?.assignedTechnician !== undefined
      ? (jobOrTechnician as Job).assignedTechnician
      : jobOrTechnician;

  return getFullName(technician) || "Not Assigned";
};

export type JobsResponse = {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type JobFilters = {
  status?: string;
  jobType?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type InspectionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "date"
  | "time"
  | "photo"
  | "photo-multi"
  | "rating"
  | "signature"
  | "yes-no"
  | "yes-no-na"
  | "pass-fail"
  | "pass-fail-na"
  | "checkbox"
  | "checkbox-group"
  | "table"
  | "radio";

export type InspectionTableColumn = {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "date"
    | "photo"
    | "photo-multi";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  metadata?: Record<string, any>;
  options?: InspectionFieldOption[];
};

export type InspectionFieldOption = {
  value: string;
  label: string;
};

export type InspectionField = {
  id: string;
  label: string;
  question?: string;
  type: InspectionFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: InspectionFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  metadata?: Record<string, any>;
  columns?: InspectionTableColumn[];
};

export type InspectionSection = {
  id: string;
  title: string;
  description?: string;
  repeatable?: boolean;
  minItems?: number;
  addButtonLabel?: string;
  itemLabel?: string;
  metadata?: Record<string, any>;
  fields: InspectionField[];
};

export type InspectionTemplate = {
  id?: string;
  jobType: string;
  title: string;
  version: number;
  metadata?: Record<string, any>;
  sections: InspectionSection[];
};

export type InspectionTemplateResponse = {
  id: string;
  jobType: string;
  title: string;
  version: number;
  metadata?: Record<string, any>;
  sections: InspectionSection[];
};

export type JobInspectionTemplateResponse = {
  template: InspectionTemplate;
  job: {
    id: string;
    job_id: string;
    jobType: string;
    status: string;
    dueDate: string;
  };
  property: {
    id: string;
    address?: Job["property"]["address"];
    propertyType?: string;
    bedroomCount?: number;
    bathroomCount?: number;
  } | null;
  technician: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    licenseNumber?: string;
  } | null;
};

export type InspectionMediaUpload = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export type InspectionSubmissionPayload = {
  template: InspectionTemplate;
  formValues: Record<string, any>;
  mediaByField: Record<string, InspectionMediaUpload[]>;
  notes?: string;
};

export type InspectionReportSummary = {
  id: string;
  job: any;
  property: any;
  technician: any;
  jobType: string;
  templateVersion: number;
  submittedAt: string;
  pdf?: {
    url?: string;
  };
  notes?: string;
};

export const fetchInspectionTemplates = async (): Promise<
  InspectionTemplate[]
> => {
  const baseUrl = BASE_URL;
  const token = await getToken();

  const res = await fetch(`${baseUrl}/api/v1/inspections/templates`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || "Failed to load inspection templates");
  }

  return json.data as InspectionTemplate[];
};

export const fetchInspectionTemplate = async (
  jobType: string,
  options?: { bedroomCount?: number; bathroomCount?: number }
): Promise<InspectionTemplate> => {
  const baseUrl = BASE_URL;
  const token = await getToken();

  // Build query parameters for dynamic templates
  const queryParams = new URLSearchParams();
  if (options?.bedroomCount) {
    queryParams.append('bedroomCount', options.bedroomCount.toString());
  }
  if (options?.bathroomCount) {
    queryParams.append('bathroomCount', options.bathroomCount.toString());
  }

  const url = `${baseUrl}/api/v1/inspections/templates/${encodeURIComponent(jobType)}`;
  const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

  const res = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || "Failed to load inspection template");
  }

  return json.data as InspectionTemplate;
};

export const fetchJobInspectionTemplate = async (
  jobId: string
): Promise<JobInspectionTemplateResponse> => {
  const baseUrl = BASE_URL;
  const token = await getToken();

  const res = await fetch(`${baseUrl}/api/v1/inspections/jobs/${jobId}/template`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || "Failed to load job inspection template");
  }

  return json.data as JobInspectionTemplateResponse;
};

export const getMediaStorageKey = (
  sectionId: string,
  fieldId: string,
  itemIndex?: number
) => {
  if (itemIndex === undefined) {
    return fieldId;
  }
  return `${sectionId}__${itemIndex}__${fieldId}`;
};

const isGasV3Template = (template: InspectionTemplate) =>
  template.jobType === "Gas" &&
  Array.isArray(template.sections) &&
  template.sections.some(
    (section) => section.id === "gas-appliances" && section.repeatable
  );

const normalizeSubmissionFormData = (
  template: InspectionTemplate,
  formValues: Record<string, any>
) => {
  const normalized = JSON.parse(JSON.stringify(formValues || {}));

  if (isGasV3Template(template)) {
    if (normalized["final-declaration"]) {
      delete normalized["final-declaration"]["final-compliance-outcome"];
    }
    if (normalized["compliance-assessment"]) {
      delete normalized["compliance-assessment"]["overall-assessment"];
    }
  }

  return normalized;
};

type CollectedMediaEntry = {
  uploadFieldId: string;
  file: { uri: string; name: string; type: string };
  clientMediaId: string;
  sizeBytes: number;
};

type CollectedMedia = {
  /** Per-upload-field label and metadata, keyed by uploadFieldId. */
  fieldMeta: Record<string, { label: string; metadata: Record<string, any> }>;
  entries: CollectedMediaEntry[];
};

/**
 * Walks the template and returns every photo to upload as a flat list, along
 * with the per-field metadata the server needs. Kept separate from request
 * building so the same traversal can produce either one request (legacy) or a
 * sequence of batches (resumable flow).
 *
 * Each entry carries a deterministic `clientMediaId` derived from the field and
 * the file's own uri/name. The server dedupes on this, so a resumed submission
 * re-sends the same ids and already-uploaded photos are skipped rather than
 * duplicated.
 */
const collectInspectionMedia = (
  payload: InspectionSubmissionPayload
): CollectedMedia => {
  const fieldMeta: CollectedMedia["fieldMeta"] = {};
  const entries: CollectedMediaEntry[] = [];

  const appendMedia = (
    uploadFieldId: string,
    field: InspectionField,
    items: InspectionMediaUpload[],
    metadata: Record<string, any>
  ) => {
    const fieldLabel = field.question || field.label || field.id;
    fieldMeta[uploadFieldId] = {
      label: fieldLabel,
      metadata: { ...metadata, count: items.length },
    };

    items.forEach((item, index) => {
      const name =
        item.name ||
        `${uploadFieldId}-${index + 1}.${item.type?.split("/").pop()}`;

      entries.push({
        uploadFieldId,
        file: { uri: item.uri, name, type: item.type || "image/jpeg" },
        clientMediaId: `${uploadFieldId}::${item.uri}::${name}`,
        sizeBytes: item.size || 0,
      });
    });
  };

  payload.template.sections.forEach((section) => {
    if (section.repeatable) {
      const sectionItems = Array.isArray(payload.formValues[section.id])
        ? payload.formValues[section.id]
        : [];

      sectionItems.forEach((_: any, itemIndex: number) => {
        section.fields.forEach((field) => {
          const storageKey = getMediaStorageKey(section.id, field.id, itemIndex);
          const items = payload.mediaByField[storageKey];
          if (!items?.length) {
            return;
          }

          appendMedia(`${field.id}-${itemIndex}`, field, items, {
            sectionId: section.id,
            fieldId: field.id,
            itemIndex,
          });
        });
      });
      return;
    }

    section.fields.forEach((field) => {
      if (field.type === "table") {
        const rows = Array.isArray(payload.formValues[section.id]?.[field.id])
          ? payload.formValues[section.id][field.id]
          : [];
        const photoColumns = (field.columns || []).filter(
          (column) => column.type === "photo" || column.type === "photo-multi"
        );

        rows.forEach((_: any, rowIndex: number) => {
          photoColumns.forEach((column) => {
            const nestedFieldId = `${field.id}.${column.id}`;
            const storageKey = getMediaStorageKey(
              section.id,
              nestedFieldId,
              rowIndex
            );
            const items = payload.mediaByField[storageKey];
            if (!items?.length) {
              return;
            }

            appendMedia(
              `${field.id}-${column.id}-${rowIndex}`,
              { ...column, type: column.type } as InspectionField,
              items,
              {
                sectionId: section.id,
                fieldId: column.id,
                parentFieldId: field.id,
                itemIndex: rowIndex,
              }
            );
          });
        });
      }

      const storageKey = getMediaStorageKey(section.id, field.id);
      const items = payload.mediaByField[storageKey];
      if (items && items.length) {
        appendMedia(field.id, field, items, {
          sectionId: section.id,
          fieldId: field.id,
        });
      }
    });
  });

  return { fieldMeta, entries };
};

export const submitInspectionReport = async (
  jobId: string,
  payload: InspectionSubmissionPayload
): Promise<{
  report: InspectionReportSummary;
  pdf?: { url?: string };
}> => {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  const formData = new FormData();
  formData.append("jobType", payload.template.jobType);
  formData.append("templateVersion", String(payload.template.version));
  const normalizedFormData = normalizeSubmissionFormData(
    payload.template,
    payload.formValues
  );
  formData.append("formData", JSON.stringify(normalizedFormData));

  if (payload.notes) {
    formData.append("notes", payload.notes);
  }

  const { fieldMeta, entries } = collectInspectionMedia(payload);
  const mediaMeta: Record<string, any> = {};

  entries.forEach((entry) => {
    if (!mediaMeta[entry.uploadFieldId]) {
      const base = fieldMeta[entry.uploadFieldId];
      mediaMeta[entry.uploadFieldId] = {
        label: base.label,
        metadata: { ...base.metadata, clientMediaIds: [] },
      };
    }
    mediaMeta[entry.uploadFieldId].metadata.clientMediaIds.push(
      entry.clientMediaId
    );
    formData.append(`media__${entry.uploadFieldId}`, entry.file as any);
  });

  if (Object.keys(mediaMeta).length) {
    formData.append("mediaMeta", JSON.stringify(mediaMeta));
  }

  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(jobId);
  console.log("[submitInspectionReport] Request details:", {
    url: `${baseUrl}/api/v1/inspections/jobs/${jobId}`,
    jobId: jobId,
    jobIdType: typeof jobId,
    jobIdLength: jobId?.length,
    isValidObjectId: isValidObjectId
  });

  if (!isValidObjectId) {
    console.error("[submitInspectionReport] ERROR: Invalid MongoDB ObjectId format:", jobId);
    throw new Error(`Invalid job ID format: ${jobId}. Expected 24-character MongoDB ObjectId.`);
  }

  // Reports with many photos can take several minutes to upload and render on
  // the server. The platform default socket timeout (60s on iOS) is well below
  // that, so it must be overridden explicitly — otherwise a submission that is
  // still progressing normally looks like a failure and gets retried, which
  // used to start a second upload on top of the first.
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    INSPECTION_SUBMIT_TIMEOUT_MS
  );

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/inspections/jobs/${jobId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(
        "The report is taking longer than expected to upload. Check your connection and try again — if photos were already uploaded they will not be duplicated."
      );
    }
    throw new Error(e?.message || "Network request failed");
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json();
  if (!res.ok) {
    if (res.status === 409) {
      throw new Error(
        json?.message ||
          "This report is already being submitted. Please wait for it to finish."
      );
    }
    throw new Error(json?.message || "Failed to submit inspection report");
  }

  return json.data;
};

/** Photos per media batch. Small enough that one request stays well inside the
 *  server's per-request memory budget, large enough to avoid excessive
 *  round-trips on a 100-photo report. */
const MEDIA_BATCH_MAX_FILES = 8;
/** Byte ceiling per batch, applied alongside the file count. HEIC photos run
 *  1–4 MB each, so the count alone is not a reliable proxy for request size. */
const MEDIA_BATCH_MAX_BYTES = 12 * 1024 * 1024;
/** Per-request timeout for the staged calls. Each one is bounded work now, so
 *  these can be far shorter than the old single-shot 10 minutes. */
const SUBMISSION_STEP_TIMEOUT_MS = 3 * 60 * 1000;
const FINALIZE_TIMEOUT_MS = 8 * 60 * 1000;

export type InspectionSubmitProgress = {
  phase: "creating" | "uploading" | "finalizing";
  uploadedMedia: number;
  totalMedia: number;
};

/** Per-field metadata for a single photo, shaped the way the server's
 *  media-batch handler expects. `clientMediaIds` is positional: the server
 *  matches ids to files by index within the field, so a one-file request
 *  carries a one-element array. */
const buildSingleMediaMeta = (
  entry: CollectedMediaEntry,
  fieldMeta: CollectedMedia["fieldMeta"]
) => {
  const base = fieldMeta[entry.uploadFieldId];
  return {
    [entry.uploadFieldId]: {
      label: base.label,
      metadata: { ...base.metadata, clientMediaIds: [entry.clientMediaId] },
    },
  };
};

/**
 * Uploads one photo through the OS background session.
 *
 * One file per request rather than eight: `uploadAsync` takes a single file,
 * and the trade is worth it. Each request is small enough to survive a poor
 * connection, the server decodes one image at a time instead of eight (which
 * is what was driving it out of memory), and an interruption costs at most one
 * photo instead of a whole batch.
 */
const uploadMediaEntryInBackground = async (
  fs: any,
  url: string,
  authHeaders: Record<string, string>,
  entry: CollectedMediaEntry,
  fieldMeta: CollectedMedia["fieldMeta"]
): Promise<void> => {
  const result = await fs.uploadAsync(url, entry.file.uri, {
    httpMethod: "POST",
    uploadType: fs.FileSystemUploadType.MULTIPART,
    sessionType: fs.FileSystemSessionType.BACKGROUND,
    fieldName: `media__${entry.uploadFieldId}`,
    mimeType: entry.file.type,
    parameters: {
      mediaMeta: JSON.stringify(buildSingleMediaMeta(entry, fieldMeta)),
    },
    headers: authHeaders,
  });

  if (result.status < 200 || result.status >= 300) {
    let message = `Uploading photos failed (${result.status})`;
    try {
      const parsed = JSON.parse(result.body);
      if (parsed?.message) message = parsed.message;
    } catch {
      // Non-JSON error body; the status code is all we have.
    }
    throw new Error(message);
  }
};

/**
 * `fetch` with a timeout that only runs while the app is in the foreground.
 *
 * A plain `setTimeout` is frozen along with the rest of the JS thread when the
 * app is backgrounded, then fires the moment it resumes — so a technician who
 * took a two-minute call came back to an instant "timed out" on a request that
 * had never had a chance to run. Suspending the deadline while the app is away
 * means the timeout measures time the request was actually able to make
 * progress, which is what it was always meant to measure.
 */
const requestWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  description: string
): Promise<any> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let remainingMs = timeoutMs;
  let startedAt = Date.now();

  const startTimer = () => {
    startedAt = Date.now();
    timeoutId = setTimeout(() => controller.abort(), remainingMs);
  };
  const stopTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      remainingMs = Math.max(1000, remainingMs - (Date.now() - startedAt));
    }
  };

  if (AppState.currentState === "active") {
    startTimer();
  }
  const appStateSub = AppState.addEventListener("change", (next) => {
    if (next === "active") {
      if (!timeoutId) startTimer();
    } else {
      stopTimer();
    }
  });

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(
        `${description} timed out. Check your connection and try again — work already uploaded will not be repeated.`
      );
    }
    throw new Error(e?.message || "Network request failed");
  } finally {
    stopTimer();
    appStateSub.remove();
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || `${description} failed`);
  }
  return json;
};

/**
 * Submits an inspection report and completes the job using the server's staged
 * submission flow: create a submission, upload photos in batches, then finalize.
 *
 * This replaces the previous approach of one large upload followed by a separate
 * completion call. That had two failure modes this design removes:
 *
 *  - The single request carried every photo at once (100 MB+ for a large
 *    Minimum Safety Standard job), which timed out and exhausted server memory.
 *    Batches keep each request small and let an interrupted upload resume.
 *  - Report submission and job completion were separate requests, so anything
 *    interrupting the gap left the report saved but the job not completed.
 *    Finalize does both server-side, and is idempotent.
 *
 * `clientSubmissionId` must be stable across retries of the same report — it is
 * how the server recognises a resumed submission rather than a new one.
 */
export const submitInspectionReportResumable = async (
  jobId: string,
  payload: InspectionSubmissionPayload,
  options: {
    clientSubmissionId: string;
    onProgress?: (progress: InspectionSubmitProgress) => void;
    /** clientMediaIds already confirmed uploaded by an earlier attempt. Those
     *  photos are skipped entirely, so a resumed submission does not re-send
     *  bytes the server would only discard. */
    completedMediaIds?: string[];
    /** Called after each photo lands, so the caller can persist progress and
     *  resume from this exact point if the attempt is interrupted. */
    onMediaUploaded?: (clientMediaId: string) => void;
    /** Called once the server-side submission exists. */
    onSubmissionCreated?: (submissionId: string) => void;
  }
): Promise<{ submissionId: string; completion: any }> => {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
    throw new Error(
      `Invalid job ID format: ${jobId}. Expected 24-character MongoDB ObjectId.`
    );
  }

  const authHeaders = { Authorization: `Bearer ${token}` };
  const { fieldMeta, entries } = collectInspectionMedia(payload);
  const totalMedia = entries.length;

  const report = (phase: InspectionSubmitProgress["phase"], uploaded: number) =>
    options.onProgress?.({ phase, uploadedMedia: uploaded, totalMedia });

  // 1. Create (or resume) the submission record.
  report("creating", 0);
  const createJson = await requestWithTimeout(
    `${baseUrl}/api/v1/jobs/${jobId}/inspection-submissions`,
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSubmissionId: options.clientSubmissionId,
        jobType: payload.template.jobType,
        templateVersion: payload.template.version,
        formData: normalizeSubmissionFormData(
          payload.template,
          payload.formValues
        ),
        notes: payload.notes || "",
      }),
    },
    SUBMISSION_STEP_TIMEOUT_MS,
    "Preparing the report"
  );

  const submissionId = createJson?.data?.submissionId;
  if (!submissionId) {
    throw new Error("Server did not return a submission id");
  }
  options.onSubmissionCreated?.(submissionId);

  // 2. Upload photos. Anything a previous attempt already landed is skipped
  //    here rather than re-sent, and the server dedupes on clientMediaId as a
  //    second line of defence if this list is ever behind.
  const mediaUrl = `${baseUrl}/api/v1/jobs/inspection-submissions/${submissionId}/media-batch`;
  const alreadyUploaded = new Set(options.completedMediaIds || []);
  const pending = entries.filter(
    (entry) => !alreadyUploaded.has(entry.clientMediaId)
  );

  let uploaded = totalMedia - pending.length;
  report("uploading", uploaded);

  const uploader = getBackgroundUploader();

  if (uploader) {
    // Preferred path: one photo per request, handed to the OS so it continues
    // through a phone call or an app switch.
    for (const entry of pending) {
      await uploadMediaEntryInBackground(
        uploader,
        mediaUrl,
        authHeaders,
        entry,
        fieldMeta
      );
      options.onMediaUploaded?.(entry.clientMediaId);
      uploaded += 1;
      report("uploading", uploaded);
    }
  } else {
    // Fallback for any build without the file-system module: the original
    // batched fetch. Correct, but dies if the app leaves the foreground.
    const batches: CollectedMediaEntry[][] = [];
    let current: CollectedMediaEntry[] = [];
    let currentBytes = 0;

    for (const entry of pending) {
      const wouldExceed =
        current.length >= MEDIA_BATCH_MAX_FILES ||
        (current.length > 0 &&
          currentBytes + entry.sizeBytes > MEDIA_BATCH_MAX_BYTES);

      if (wouldExceed) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }

      current.push(entry);
      currentBytes += entry.sizeBytes;
    }
    if (current.length) {
      batches.push(current);
    }

    for (const batch of batches) {
      const form = new FormData();
      const batchMeta: Record<string, any> = {};

      // Files are matched to their clientMediaId by position within each field,
      // so append order and the id array must stay in step.
      for (const entry of batch) {
        if (!batchMeta[entry.uploadFieldId]) {
          const base = fieldMeta[entry.uploadFieldId];
          batchMeta[entry.uploadFieldId] = {
            label: base.label,
            metadata: { ...base.metadata, clientMediaIds: [] },
          };
        }
        batchMeta[entry.uploadFieldId].metadata.clientMediaIds.push(
          entry.clientMediaId
        );
        form.append(`media__${entry.uploadFieldId}`, entry.file as any);
      }

      form.append("mediaMeta", JSON.stringify(batchMeta));

      await requestWithTimeout(
        mediaUrl,
        { method: "POST", headers: authHeaders, body: form },
        SUBMISSION_STEP_TIMEOUT_MS,
        "Uploading photos"
      );

      for (const entry of batch) {
        options.onMediaUploaded?.(entry.clientMediaId);
      }
      uploaded += batch.length;
      report("uploading", uploaded);
    }
  }

  // 3. Finalize: submits the report and completes the job in one step.
  report("finalizing", uploaded);
  const finalizeJson = await requestWithTimeout(
    `${baseUrl}/api/v1/jobs/inspection-submissions/${submissionId}/finalize`,
    { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: "{}" },
    FINALIZE_TIMEOUT_MS,
    "Finalising the report"
  );

  return { submissionId, completion: finalizeJson?.data ?? finalizeJson };
};

// Fetch available jobs
export async function fetchAvailableJobs(
  filters: JobFilters = {}
): Promise<JobsResponse> {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, value.toString());
    }
  });

  // Default to pending jobs if no status filter specified
  if (!filters.status) {
    queryParams.append("status", "Pending");
  }

  // Default query parameters for available jobs
  if (!filters.limit) {
    queryParams.append("limit", "50");
  }
  if (!filters.sortBy) {
    queryParams.append("sortBy", "dueDate");
  }
  if (!filters.sortOrder) {
    queryParams.append("sortOrder", "asc");
  }

  try {
    const url = `${baseUrl}/api/v1/jobs/available-jobs${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    console.log("[fetchAvailableJobs] URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    console.log(json, "JSON Response...");
    console.log(JSON.stringify(json), "JSON Stringify Response...");
    console.log(
      "First job structure:",
      JSON.stringify(json.data?.jobs?.[0], null, 2)
    );

    if (!res.ok) {
      throw new Error(json?.message || "Failed to fetch available jobs");
    }

    return json.data;
  } catch (e: any) {
    console.log("[fetchAvailableJobs] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Fetch technician's assigned jobs
export async function fetchTechnicianJobs(
  filters: JobFilters = {}
): Promise<JobsResponse> {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  const endpoint =
    filters.status === "Overdue"
      ? "/api/v1/technicians/overdue-jobs"
      : "/api/v1/technicians/jobs";

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (filters.status === "Overdue" && key === "status") {
        return;
      }
      queryParams.append(key, value.toString());
    }
  });

  // Set default pagination if not provided
  if (!filters.page) {
    queryParams.append("page", "1");
  }
  if (!filters.limit) {
    queryParams.append("limit", "50");
  }

  try {
    const url = `${baseUrl}${endpoint}${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    console.log("[fetchTechnicianJobs] URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    console.log(
      "[fetchTechnicianJobs] Response:",
      JSON.stringify(json, null, 2)
    );

    if (!res.ok) {
      // Handle specific authentication errors
      if (res.status === 401) {
        throw new Error("Authentication expired. Please login again.");
      }
      throw new Error(json?.message || "Failed to fetch technician jobs");
    }

    if (json.status !== "success") {
      throw new Error(json?.message || "API returned error status");
    }

    return json.data;
  } catch (e: any) {
    console.log("[fetchTechnicianJobs] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Claim a job
export async function claimJob(jobId: string): Promise<{ message: string }> {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}/claim`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.message || "Failed to claim job");
    }

    return json;
  } catch (e: any) {
    console.log("[claimJob] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Get job details
export async function fetchJobDetails(jobId: string): Promise<Job> {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    console.log("[fetchJobDetails] Response:", JSON.stringify(json, null, 2));

    if (!res.ok) {
      throw new Error(json?.message || "Failed to fetch job details");
    }

    return json.data.job;
  } catch (e: any) {
    console.log("[fetchJobDetails] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Complete a job with optional report and invoice
export async function completeJob(
  jobId: string,
  completionData: {
    reportFile?: {
      uri: string;
      name: string;
      type: string;
      size: number;
    };
    inspectionReportId?: string;
  }
): Promise<{ message: string; job: Job }> {
  const baseUrl = BASE_URL;
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  try {
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    // Technician-entered invoice creation is disabled in the mobile flow.
    formData.append("hasInvoice", "false");

    if (completionData.inspectionReportId) {
      formData.append("inspectionReportId", completionData.inspectionReportId);
    }

    // Add report file if provided
    if (completionData.reportFile) {
      formData.append("reportFile", {
        uri: completionData.reportFile.uri,
        type: completionData.reportFile.type,
        name: completionData.reportFile.name,
      } as any);
    }

    console.log("[completeJob] Sending completion data for job:", jobId);
    console.log(
      "[completeJob] Full URL:",
      `${baseUrl}/api/v1/jobs/${jobId}/complete`
    );
    console.log("[completeJob] FormData contents:");
    console.log("- hasInvoice:", "false");
    if (completionData.inspectionReportId) {
      console.log("- inspectionReportId:", completionData.inspectionReportId);
    }

    const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}/complete`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type for FormData, let the browser set it
      },
      body: formData,
    });

    const json = await res.json();
    console.log("[completeJob] Response:", JSON.stringify(json, null, 2));

    if (!res.ok) {
      throw new Error(json?.message || "Failed to complete job");
    }

    return json.data || json;
  } catch (e: any) {
    console.log("[completeJob] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}
