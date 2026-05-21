import { Platform } from "react-native";
import { getToken } from "./secureStore";
import { TECHNICIAN_PAYMENTS_ENABLED } from "../config/features";

const RAW_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;

function getBaseUrl(): string {
  if (!RAW_BASE_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_BASE_URL. Set it in .env (e.g., http://localhost:4000) and restart the dev server."
    );
  }
  try {
    const url = new URL(RAW_BASE_URL);
    // Normalize localhost for simulators/emulators
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      if (Platform.OS === "android") {
        url.hostname = "10.0.2.2";
      } else {
        url.hostname = "127.0.0.1";
      }
    }
    // Remove trailing slash
    return url.toString().replace(/\/$/, "");
  } catch {
    return RAW_BASE_URL;
  }
}

export type TechnicianPayment = {
  id: string;
  paymentNumber: string;
  amount: number;
  status: "Pending" | "Paid" | "Cancelled" | "Processing";
  createdAt: string;
  jobCompletedAt: string;
  jobId: {
    _id: string;
    job_id: string;
    jobType: string;
    dueDate: string;
    description: string;
    property: string;
  };
  jobType: string;
  technicianId: string;
  paidAt?: string;
  notes?: string;
};

export type PaymentsResponse = {
  payments: TechnicianPayment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalPending: number;
    totalPaid: number;
    pendingAmount: number;
    paidAmount: number;
  };
};

export type PaymentFilters = {
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

// Fetch technician's payments
export async function fetchTechnicianPayments(
  filters: PaymentFilters = {}
): Promise<PaymentsResponse> {
  if (!TECHNICIAN_PAYMENTS_ENABLED) {
    return {
      payments: [],
      pagination: {
        page: 1,
        limit: filters.limit || 50,
        total: 0,
        totalPages: 0,
      },
      summary: {
        totalPending: 0,
        totalPaid: 0,
        pendingAmount: 0,
        paidAmount: 0,
      },
    };
  }

  const baseUrl = getBaseUrl();
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
  if (!filters.sortBy) {
    queryParams.append("sortBy", "createdAt");
  }
  if (!filters.sortOrder) {
    queryParams.append("sortOrder", "desc");
  }

  try {
    const url = `${baseUrl}/api/v1/technician-payments/my-payments${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    console.log("[fetchTechnicianPayments] URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    console.log("[fetchTechnicianPayments] Response:", JSON.stringify(json, null, 2));

    if (!res.ok) {
      // Handle specific authentication errors
      if (res.status === 401) {
        throw new Error("Authentication expired. Please login again.");
      }
      throw new Error(json?.message || "Failed to fetch payments");
    }

    if (json.status !== "success") {
      throw new Error(json?.message || "API returned error status");
    }

    // Transform the response to match our expected structure
    const transformedData = {
      payments: json.data.payments || [],
      pagination: {
        page: json.data.pagination?.currentPage || 1,
        limit: json.data.pagination?.limit || 20,
        total: json.data.pagination?.totalItems || 0,
        totalPages: json.data.pagination?.totalPages || 1,
      },
      summary: {
        totalPending: json.data.statistics?.statusCounts?.Pending || 0,
        totalPaid: json.data.statistics?.statusCounts?.Paid || 0,
        pendingAmount: 0, // Will need to calculate from payments
        paidAmount: 0, // Will need to calculate from payments
      },
    };

    // Calculate amounts from payments
    json.data.payments?.forEach((payment: any) => {
      if (payment.status === "Pending") {
        transformedData.summary.pendingAmount += payment.amount || 0;
      } else if (payment.status === "Paid") {
        transformedData.summary.paidAmount += payment.amount || 0;
      }
    });

    return transformedData;
  } catch (e: any) {
    console.log("[fetchTechnicianPayments] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Get payment details
export async function fetchPaymentDetails(paymentId: string): Promise<TechnicianPayment> {
  if (!TECHNICIAN_PAYMENTS_ENABLED) {
    throw new Error("Technician payment feature is disabled");
  }

  const baseUrl = getBaseUrl();
  const token = await getToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/technicians/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    console.log("[fetchPaymentDetails] Response:", JSON.stringify(json, null, 2));

    if (!res.ok) {
      throw new Error(json?.message || "Failed to fetch payment details");
    }

    return json.data.payment;
  } catch (e: any) {
    console.log("[fetchPaymentDetails] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}

// Export payment data (for CSV/PDF reports)
export async function exportPayments(
  filters: PaymentFilters & { format: "csv" | "pdf" } = { format: "csv" }
): Promise<{ url: string; filename: string }> {
  if (!TECHNICIAN_PAYMENTS_ENABLED) {
    throw new Error("Technician payment feature is disabled");
  }

  const baseUrl = getBaseUrl();
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

  try {
    const url = `${baseUrl}/api/v1/technicians/payments/export${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    console.log("[exportPayments] URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();
    console.log("[exportPayments] Response:", JSON.stringify(json, null, 2));

    if (!res.ok) {
      throw new Error(json?.message || "Failed to export payments");
    }

    return json.data;
  } catch (e: any) {
    console.log("[exportPayments] error", {
      name: e?.name,
      message: e?.message,
      stack: e?.stack,
    });
    throw new Error(e?.message || "Network request failed");
  }
}
