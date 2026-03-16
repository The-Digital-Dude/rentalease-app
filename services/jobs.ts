import { getToken } from "./secureStore";
import { BASE_URL } from "../config/api";

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
  type: "text" | "textarea" | "number" | "select" | "date";
  required?: boolean;
  placeholder?: string;
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

export type InspectionMediaUpload = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export type InspectionSubmissionPayload = {
  template: InspectionTemplate;
  formValues: Record<string, Record<string, any>>;
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
  formData.append("formData", JSON.stringify(payload.formValues));

  if (payload.notes) {
    formData.append("notes", payload.notes);
  }

  const mediaMeta: Record<string, any> = {};
  payload.template.sections.forEach((section) => {
    section.fields.forEach((field) => {
      const items = payload.mediaByField[field.id];
      if (items && items.length) {
        const fieldLabel = field.question || field.label || field.id;
        mediaMeta[field.id] = {
          label: fieldLabel,
          metadata: {
            sectionId: section.id,
            count: items.length,
          },
        };

        items.forEach((item, index) => {
          formData.append(`media__${field.id}`, {
            uri: item.uri,
            name:
              item.name ||
              `${field.id}-${index + 1}.${item.type?.split("/").pop()}`,
            type: item.type || "image/jpeg",
          } as any);
        });
      }
    });
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

  const res = await fetch(`${baseUrl}/api/v1/inspections/jobs/${jobId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || "Failed to submit inspection report");
  }

  return json.data;
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
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
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
    const url = `${baseUrl}/api/v1/technicians/jobs${
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
    hasInvoice: boolean;
    invoiceData?: {
      description: string;
      lineItems: Array<{
        id: string;
        name: string;
        quantity: number;
        rate: number;
        amount: number;
      }>;
      taxPercentage: number;
      subtotal: number;
      taxAmount: number;
      total: number;
      notes?: string;
    };
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
    // Add invoice flag
    formData.append("hasInvoice", completionData.hasInvoice.toString());

    if (completionData.inspectionReportId) {
      formData.append("inspectionReportId", completionData.inspectionReportId);
    }

    // Add invoice data if provided
    if (completionData.hasInvoice && completionData.invoiceData) {
      const invoiceDataString = JSON.stringify(completionData.invoiceData);
      console.log("[completeJob] Invoice data string:", invoiceDataString);
      formData.append("invoiceData", invoiceDataString);
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
    console.log("- hasInvoice:", completionData.hasInvoice.toString());
    if (completionData.inspectionReportId) {
      console.log("- inspectionReportId:", completionData.inspectionReportId);
    }
    if (completionData.hasInvoice && completionData.invoiceData) {
      console.log("- invoiceData:", JSON.stringify(completionData.invoiceData));
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
