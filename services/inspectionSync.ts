import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createInspectionSubmission,
  finalizeInspectionSubmission,
  normalizeInspectionMediaByField,
  uploadInspectionSubmissionMediaBatch,
  type InspectionMediaUpload,
  type InspectionSubmissionPayload,
  type InspectionTemplate,
} from "./jobs";

const INSPECTION_SYNC_QUEUE_KEY = "inspectionSyncQueue:v1";
const INSPECTION_MEDIA_BATCH_SIZE = 5;
let inspectionSyncInFlight: Promise<void> | null = null;

export type PendingInspectionSyncItem = {
  id: string;
  clientSubmissionId: string;
  submissionId?: string | null;
  jobId: string;
  jobType: string;
  template: InspectionTemplate;
  formValues: Record<string, any>;
  mediaByField: Record<string, InspectionMediaUpload[]>;
  uploadedClientMediaIds?: string[];
  notes?: string;
  nextComplianceDate?: string;
  eventLocalTimestamp?: string;
  eventTimezone?: string;
  timestampSource?: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string | null;
};

const isQueueableNetworkError = (error: unknown) => {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return [
    "network request failed",
    "failed to fetch",
    "network error",
    "request timed out",
    "timed out",
    "load failed",
    "internet",
  ].some((fragment) => message.includes(fragment));
};

const isAlreadyCompletedError = (error: unknown) => {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes("already completed");
};

const readQueue = async (): Promise<PendingInspectionSyncItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(INSPECTION_SYNC_QUEUE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          ...item,
          mediaByField: normalizeInspectionMediaByField(item.mediaByField || {}),
        }))
      : [];
  } catch (error) {
    console.warn("[inspectionSync] Failed to read queue", error);
    return [];
  }
};

const writeQueue = async (queue: PendingInspectionSyncItem[]) => {
  await AsyncStorage.setItem(INSPECTION_SYNC_QUEUE_KEY, JSON.stringify(queue));
};

const upsertQueueItem = async (item: PendingInspectionSyncItem) => {
  const queue = await readQueue();
  const nextQueue = [
    item,
    ...queue.filter((entry) => entry.id !== item.id && entry.jobId !== item.jobId),
  ];
  await writeQueue(nextQueue);
};

const removeQueueItem = async (id: string) => {
  const queue = await readQueue();
  await writeQueue(queue.filter((entry) => entry.id !== id));
};

const updateQueueItem = async (
  id: string,
  updater: (item: PendingInspectionSyncItem) => PendingInspectionSyncItem
) => {
  const queue = await readQueue();
  const nextQueue = queue.map((item) => (item.id === id ? updater(item) : item));
  await writeQueue(nextQueue);
};

const syncPendingItem = async (item: PendingInspectionSyncItem) => {
  let submissionId = item.submissionId || null;
  if (!submissionId) {
    const submission = await createInspectionSubmission(item.jobId, {
      clientSubmissionId: item.clientSubmissionId,
      template: item.template,
      formValues: item.formValues,
      mediaByField: item.mediaByField,
      notes: item.notes,
      nextComplianceDate: item.nextComplianceDate,
      eventLocalTimestamp: item.eventLocalTimestamp,
      eventTimezone: item.eventTimezone,
      timestampSource: item.timestampSource,
    });
    submissionId = submission.submissionId;
    await updateQueueItem(item.id, (current) => ({
      ...current,
      submissionId,
      updatedAt: new Date().toISOString(),
      lastError: null,
    }));
  }

  let uploadedClientMediaIds = new Set(item.uploadedClientMediaIds || []);
  while (true) {
    const batchPayload = buildNextMediaBatchPayload({
      template: item.template,
      formValues: item.formValues,
      mediaByField: item.mediaByField,
      uploadedClientMediaIds,
      maxItems: INSPECTION_MEDIA_BATCH_SIZE,
    });

    if (!batchPayload) {
      break;
    }

    await uploadInspectionSubmissionMediaBatch(submissionId, batchPayload);
    for (const clientMediaId of collectClientMediaIds(batchPayload.mediaByField)) {
      uploadedClientMediaIds.add(clientMediaId);
    }

    const serializedUploadedIds = Array.from(uploadedClientMediaIds);
    await updateQueueItem(item.id, (current) => ({
      ...current,
      submissionId,
      uploadedClientMediaIds: serializedUploadedIds,
      updatedAt: new Date().toISOString(),
      lastError: null,
    }));
  }

  const result = await finalizeInspectionSubmission(submissionId);

  await removeQueueItem(item.id);
  return result;
};

export const enqueuePendingInspectionSync = async (
  item: Omit<PendingInspectionSyncItem, "id" | "createdAt" | "updatedAt" | "retryCount">
) => {
  const now = new Date().toISOString();
  const queueItem: PendingInspectionSyncItem = {
    ...item,
    id: `${item.jobId}:${Date.now()}`,
    submissionId: item.submissionId || null,
    mediaByField: normalizeInspectionMediaByField(item.mediaByField),
    uploadedClientMediaIds: item.uploadedClientMediaIds || [],
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    lastError: null,
  };

  await upsertQueueItem(queueItem);
  return queueItem;
};

export const processPendingInspectionSyncQueue = async () => {
  if (inspectionSyncInFlight) {
    return inspectionSyncInFlight;
  }

  inspectionSyncInFlight = (async () => {
    const queue = await readQueue();

    for (const item of queue) {
      try {
        await syncPendingItem(item);
      } catch (error) {
        if (isAlreadyCompletedError(error)) {
          await removeQueueItem(item.id);
          continue;
        }

        await updateQueueItem(item.id, (current) => ({
          ...current,
          retryCount: current.retryCount + 1,
          updatedAt: new Date().toISOString(),
          lastError: String((error as any)?.message || error || "Unknown sync error"),
        }));

        if (isQueueableNetworkError(error)) {
          break;
        }
      }
    }
  })();

  try {
    await inspectionSyncInFlight;
  } finally {
    inspectionSyncInFlight = null;
  }
};

export const shouldQueueInspectionSyncError = isQueueableNetworkError;

export const getPendingInspectionSyncQueue = readQueue;

const collectClientMediaIds = (mediaByField: Record<string, InspectionMediaUpload[]>) =>
  Object.values(mediaByField)
    .flat()
    .map((media) => media.clientMediaId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

const buildNextMediaBatchPayload = ({
  template,
  formValues,
  mediaByField,
  uploadedClientMediaIds,
  maxItems,
}: {
  template: InspectionTemplate;
  formValues: Record<string, any>;
  mediaByField: Record<string, InspectionMediaUpload[]>;
  uploadedClientMediaIds: Set<string>;
  maxItems: number;
}): InspectionSubmissionPayload | null => {
  const nextMediaByField: Record<string, InspectionMediaUpload[]> = {};
  let remaining = maxItems;

  for (const [fieldKey, items] of Object.entries(mediaByField)) {
    if (remaining <= 0) {
      break;
    }

    const nextItems = (items || []).filter(
      (item) =>
        !item.clientMediaId || !uploadedClientMediaIds.has(item.clientMediaId)
    );
    if (!nextItems.length) {
      continue;
    }

    const sliced = nextItems.slice(0, remaining);
    if (sliced.length) {
      nextMediaByField[fieldKey] = sliced;
      remaining -= sliced.length;
    }
  }

  if (!Object.keys(nextMediaByField).length) {
    return null;
  }

  return {
    template,
    formValues,
    mediaByField: nextMediaByField,
  };
};
