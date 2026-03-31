import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import InspectionForm, { InspectionFormValues } from "./InspectionForm";
import type {
  InspectionTemplate,
  InspectionMediaUpload,
  InspectionField,
} from "../services/jobs";
import {
  fetchInspectionTemplates,
  fetchInspectionTemplate,
  fetchJobInspectionTemplate,
  submitInspectionReport,
  fetchJobDetails,
  getMediaStorageKey,
} from "../services/jobs";

export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  description: string;
  lineItems: InvoiceLineItem[];
  taxPercentage: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
}

export interface JobCompletionData {
  inspectionReportId?: string;
  hasInvoice: boolean;
  invoiceData?: InvoiceData;
}

interface JobCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: JobCompletionData) => Promise<void>;
  jobId: string;
  jobType: string;
  job?: {
    status: string;
    dueDate: string;
  };
}

const getFieldLabel = (field: InspectionField): string => {
  const fromQuestion = field.question?.trim();
  if (fromQuestion) {
    return fromQuestion;
  }
  const fromLabel = field.label?.trim();
  if (fromLabel) {
    return fromLabel;
  }
  return field.id;
};

const formatJobType = (jobType: string): string => {
  // Add spaces before capital letters for camelCase/PascalCase
  return jobType.replace(/([A-Z])/g, ' $1').trim();
};

const getStepsForJobType = (jobType: string) => {
  if (jobType === "MinimumSafetyStandard") {
    return [
      { key: "template", label: "Select Template" },
      { key: "rooms", label: "Room Configuration" },
      { key: "form", label: "Inspection Form" },
      { key: "invoice", label: "Invoice & Submit" },
    ] as const;
  }
  return [
    { key: "template", label: "Select Template" },
    { key: "form", label: "Inspection Form" },
    { key: "invoice", label: "Invoice & Submit" },
  ] as const;
};

type StepKey = "template" | "rooms" | "form" | "invoice";

const isGasJobType = (value?: string) =>
  typeof value === "string" && value.toLowerCase().includes("gas");

const isGasTemplateV3 = (template?: InspectionTemplate | null) =>
  !!template &&
  template.jobType === "Gas" &&
  template.sections.some(
    (section) => section.id === "gas-appliances" && section.repeatable
  );

const defaultLineItem = (): InvoiceLineItem => ({
  id: `${Date.now()}`,
  name: "",
  quantity: 1,
  rate: 0,
  amount: 0,
});

const DEFAULT_TEST_NOTES =
  "Auto-generated testing notes. Replace before final submission.";
const PLACEHOLDER_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4//8/AwAI/AL+XoELLQAAAABJRU5ErkJggg==";

const placeholderImageUri = (_seed: number) => PLACEHOLDER_IMAGE_DATA_URI;

const hasMeaningfulDefault = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
};

const getGenericPrefillValue = (
  field: InspectionField,
  today: string
): any => {
  // Only provide test/placeholder values in development mode
  if (!__DEV__) {
    // In production, return minimal defaults without test data
    switch (field.type) {
      case "date":
        return today; // Current date is reasonable default
      case "number":
        if (typeof field.min === "number") {
          return field.min;
        }
        return null;
      case "boolean":
      case "checkbox":
        return false;
      case "multi-select":
      case "checkbox-group":
        return [];
      case "photo":
      case "photo-multi":
        return [];
      default:
        return "";
    }
  }

  // Development mode: provide test data for easier testing
  const baseText =
    field.placeholder || field.label || field.question || "Auto-filled value";

  switch (field.type) {
    case "text":
    case "textarea":
      return `${baseText} (auto)`;
    case "number":
      if (typeof (field as any).defaultValue === "number") {
        return (field as any).defaultValue;
      }
      if (typeof field.min === "number") {
        return field.min;
      }
      return 1;
    case "date":
      return today;
    case "time":
      return "09:00";
    case "boolean":
    case "checkbox":
      return true;
    case "select":
      return field.options?.[0]?.value || "";
    case "multi-select":
    case "checkbox-group":
      return (field.options || []).map((option) => option.value);
    case "yes-no":
      return "yes";
    case "yes-no-na":
      return "yes";
    case "pass-fail":
    case "pass-fail-na":
      return "pass";
    case "rating":
      return field.max || 5;
    case "signature":
      return `signature_${Date.now()}`;
    case "photo":
    case "photo-multi":
      return [];
    default:
      return `${baseText} (auto)`;
  }
};

const addYears = (base: string, years: number) => {
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) {
    return base;
  }
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().split("T")[0];
};

const buildTablePlaceholderRow = (
  columns: any[],
  today: string,
  template: InspectionTemplate,
  fieldId: string
) => {
  // Only build placeholder rows in development mode
  if (!__DEV__) {
    return null;
  }

  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  if (template.jobType === "Smoke" && fieldId === "alarm-records") {
    const manufactureDate = addYears(today, -2);
    const expiryDate = addYears(today, 8);
    const batteryExpiry = addYears(today, 8);

    return {
      "alarm-id": "001",
      location: "hallway-bedrooms",
      "location-other": "",
      mounting: "ceiling",
      brand: "Lifeguard",
      model: "LG-240",
      "model-not-visible": false,
      "alarm-type": "photoelectric",
      "power-source": "mains-240v",
      "power-source-other": "",
      interconnection: "hard-wired",
      "interconnected-all-sound": "yes",
      "manufacture-date": manufactureDate,
      "manufacture-date-not-readable": false,
      "expiry-date": expiryDate,
      "expiry-date-not-stated": false,
      "age-years": 2,
      "over-10-years": "no",
      "battery-present": "yes",
      "battery-replaced-today": "yes",
      "battery-type": "lithium-10yr",
      "battery-expiry": batteryExpiry,
      "push-test-result": "pass",
      "sound-level-db": 88,
      "led-status": "flashing-normal",
      "led-status-other": "",
      "clearances-ok": "yes",
      "distance-to-wall": 55,
      "distance-to-corner": 110,
      "distance-to-fan": 150,
      "physical-condition": ["securely-mounted", "no-paint-dust"],
      "alarm-comments": "Auto-filled smoke alarm record for testing",
      "compliance-status": "compliant",
      "non-compliance-reasons": [],
      "non-compliance-other": "",
      "actions-taken": ["replaced-battery"],
      "replaced-unit-brand": "",
      "replaced-unit-model": "",
      "replaced-unit-mfd": "",
      "replaced-unit-install-date": today,
      "replaced-unit-warranty": 5,
      "replaced-interconnection-verified": "yes",
    };
  }

  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  return columns.reduce((row: Record<string, any>, column: any) => {
    switch (column.type) {
      case "number":
        if (typeof column.min === "number") {
          row[column.id] = column.min || 1;
        } else {
          row[column.id] = 1;
        }
        break;
      case "select":
        row[column.id] =
          column.options && column.options.length
            ? column.options[0].value
            : "";
        break;
      case "date":
        row[column.id] = today;
        break;
      case "checkbox":
        row[column.id] = true;
        break;
      case "yes-no":
        row[column.id] = "yes";
        break;
      case "yes-no-na":
        row[column.id] = "yes";
        break;
      case "textarea":
        row[column.id] =
          column.placeholder || `${column.label || "Detail"} (auto)`;
        break;
      default:
        row[column.id] =
          column.placeholder || `${column.label || "Value"} (auto)`;
        break;
    }
    return row;
  }, {} as Record<string, any>);
};

const generateMediaPrefillForTemplate = (
  template: InspectionTemplate
): Record<string, InspectionMediaUpload[]> => {
  // Only generate test media in development mode
  if (!__DEV__) {
    return {};
  }

  const result: Record<string, InspectionMediaUpload[]> = {};
  let seed = 1;

  template.sections.forEach((section) => {
    const repeatableCount = section.repeatable ? Math.max(section.minItems || 0, 1) : 1;

    const assignPrefill = (field: InspectionField, itemIndex?: number) => {
      if (field.type !== "photo" && field.type !== "photo-multi") {
        return;
      }

      const storageKey = getMediaStorageKey(section.id, field.id, itemIndex);
      const baseMedia = {
        uri: placeholderImageUri(seed),
        name: `${field.id}-${seed}.png`,
        type: "image/png",
      };

      if (field.type === "photo-multi") {
        result[storageKey] = [
          baseMedia,
          { ...baseMedia, name: `${field.id}-${seed + 1}.png` },
        ];
        seed += 2;
      } else {
        result[storageKey] = [baseMedia];
        seed += 1;
      }
    };

    if (section.repeatable) {
      for (let itemIndex = 0; itemIndex < repeatableCount; itemIndex += 1) {
        section.fields.forEach((field) => assignPrefill(field, itemIndex));
      }
      return;
    }

    section.fields.forEach((field) => {
      assignPrefill(field);
    });
  });

  return result;
};

const initializeFormValues = (
  template: InspectionTemplate,
  jobDetailsData?: any
): InspectionFormValues => {
  const today = new Date().toISOString().split("T")[0];

  const genericPrefill = (field: InspectionField) =>
    getGenericPrefillValue(field, today);

  const getAutoPrefillValue = (
    field: InspectionField,
    sectionId: string
  ): any => {
    const explicitDefault = (field as any).defaultValue;
    if (hasMeaningfulDefault(explicitDefault)) {
      return explicitDefault;
    }

    // Pre-fill with real job data when available
    if (jobDetailsData) {
      // Property and address information
      if (field.id === "property-address" && jobDetailsData.property?.address) {
        return `${jobDetailsData.property.address.street}, ${jobDetailsData.property.address.suburb}, ${jobDetailsData.property.address.state} ${jobDetailsData.property.address.postcode}`;
      }
      if (field.id === "property-type" && jobDetailsData.property?.propertyType) {
        return jobDetailsData.property.propertyType.toLowerCase();
      }
      if (field.id === "bedroom-count" && jobDetailsData.property?.bedrooms) {
        return jobDetailsData.property.bedrooms;
      }
      if (field.id === "storeys-count" && jobDetailsData.property?.storeys) {
        return jobDetailsData.property.storeys;
      }

      // Tenant information
      if (field.id === "tenant-name" && jobDetailsData.property?.tenant) {
        return `${jobDetailsData.property.tenant.firstName || ''} ${jobDetailsData.property.tenant.lastName || ''}`.trim();
      }
      if (field.id === "tenant-phone" && jobDetailsData.property?.tenant?.phone) {
        return jobDetailsData.property.tenant.phone;
      }
      if (field.id === "tenant-email" && jobDetailsData.property?.tenant?.email) {
        return jobDetailsData.property.tenant.email;
      }

      // Job details
      if (field.id === "job-reference" && jobDetailsData.jobReference) {
        return jobDetailsData.jobReference;
      }
      if (field.id === "inspector-name" && jobDetailsData.assignedTechnician) {
        return `${jobDetailsData.assignedTechnician.firstName || ''} ${jobDetailsData.assignedTechnician.lastName || ''}`.trim();
      }
      if (field.id === "inspection-date") {
        return new Date().toISOString().split("T")[0];
      }
      if (field.id === "next-service-due") {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear.toISOString().split("T")[0];
      }

      // Property manager information
      if (field.id === "property-manager-name" && jobDetailsData.property?.propertyManager) {
        return `${jobDetailsData.property.propertyManager.firstName || ''} ${jobDetailsData.property.propertyManager.lastName || ''}`.trim();
      }
      if (field.id === "property-manager-phone" && jobDetailsData.property?.propertyManager?.phone) {
        return jobDetailsData.property.propertyManager.phone;
      }
      if (field.id === "property-manager-email" && jobDetailsData.property?.propertyManager?.email) {
        return jobDetailsData.property.propertyManager.email;
      }

      // Access notes based on job priority or type
      if (field.id === "access-notes") {
        const notes = ["full-access"];
        if (jobDetailsData.priority === "High" || jobDetailsData.priority === "Critical") {
          notes.push("keys-provided");
        }
        return notes;
      }
    }

    // Only provide test defaults in development
    if (template.jobType === "Smoke" && __DEV__) {
      switch (field.id) {
        case "access-notes":
          return ["pets-present"];
        case "access-notes-detail":
          return "Auto-filled access notes";
        case "previous-service-date":
          return addYears(today, -1);
        case "previous-service-unknown":
          return false;
        case "storeys-covered":
          return ["ground", "level1"];
        case "hallway-bedrooms-present":
        case "between-sleeping-areas":
        case "every-storey-covered":
          return "yes";
        case "attached-garage":
          return "na";
        case "any-locations-missing":
          return "no";
        case "missing-locations":
          return "";
        case "alarm-count":
          return 3;
        case "alarms-inspected-count":
          return 3;
        case "alarms-replaced-count":
          return 1;
        case "alarms-non-compliant-count":
          return 0;
        case "general-comments":
          return "Auto-filled property summary for testing";
        case "overall-status":
          return "compliant";
        case "technician-declaration":
          return true;
        default:
          break;
      }
    }

    if (
      template.jobType === "Gas" ||
      template.title.toLowerCase().includes("gas")
    ) {
      if (
        sectionId === "property-details" ||
        field.id.includes("property") ||
        field.id.includes("date") ||
        field.id.includes("inspector") ||
        field.id.includes("license")
      ) {
        switch (field.id) {
          case "inspection-date":
          case "inspectionDate":
            return today;
          case "inspector-name":
          case "inspectorName":
            // Use real technician name if available
            if (jobDetailsData?.assignedTechnician) {
              return `${jobDetailsData.assignedTechnician.firstName || ''} ${jobDetailsData.assignedTechnician.lastName || ''}`.trim();
            }
            // In development, use test data; in production, leave empty
            return __DEV__ ? "John Smith" : "";
          case "license-number":
          case "licenseNumber":
            return __DEV__ ? "LIC123456789" : "";
          case "vba-record-number":
          case "vbaRecordNumber":
            return __DEV__ ? "VBA987654321" : "";
          default:
            if (__DEV__) {
              if (field.type === "boolean") {
                return true;
              }
              if (field.type === "select") {
                return field.options?.[0]?.value || "Yes";
              }
            }
            return genericPrefill(field);
        }
      }

      // Only provide test data in development mode
      if (__DEV__) {
        if (
          sectionId === "gas-installation" ||
          field.id.includes("gas") ||
          field.id.includes("cylinder")
        ) {
          if (field.type === "boolean") {
            return true;
          }
          if (field.type === "select") {
            return field.options?.[0]?.value || "Yes";
          }
          if (field.type === "radio") {
            return "Yes";
          }
          if (
            field.id.includes("comment") ||
            field.id.includes("note")
          ) {
            return "All components inspected and functioning correctly";
          }
        }

        if (
          sectionId.includes("appliance") ||
          field.id.includes("appliance") ||
          field.id.includes("isolation")
        ) {
          if (field.type === "boolean") {
            return true;
          }
          if (field.type === "select") {
            return field.options?.[0]?.value || "Yes";
          }
          if (field.type === "radio") {
            return "Yes";
          }
          if (
            field.id.includes("comment") ||
            field.id.includes("note")
          ) {
            return "Appliance functioning correctly";
          }
        }

        if (
          field.id.includes("correctly") ||
          field.id.includes("leakage") ||
          field.id.includes("valve") ||
          field.id.includes("test") ||
          field.id.includes("safe") ||
          field.id.includes("compliant")
        ) {
          if (field.type === "boolean") {
            return true;
          }
          if (field.type === "select" || field.type === "radio") {
            return field.id.includes("leakage") || field.id.includes("test")
              ? "Pass"
              : "Yes";
          }
          return genericPrefill(field);
        }

        if (field.type === "boolean") {
          return true;
        }
        if (field.type === "select" || field.type === "radio") {
          if (field.id.includes("test") || field.id.includes("leakage")) {
            return (
              field.options?.find((option) => option.value === "Pass")?.value ||
              field.options?.[0]?.value ||
              "Pass"
            );
          }
          return (
            field.options?.find((option) => option.value === "Yes")?.value ||
            field.options?.[0]?.value ||
            "Yes"
          );
        }
        if (
          field.id.includes("comment") ||
          field.id.includes("note") ||
          field.id.includes("observation")
        ) {
          return "Inspection completed successfully. All safety standards met.";
        }
      }
    }

    return genericPrefill(field);
  };

  return template.sections.reduce((acc, section) => {
    if (section.repeatable) {
      const itemCount = Math.max(section.minItems || 0, 1);
      acc[section.id] = Array.from({ length: itemCount }, () => {
        const itemValues: Record<string, any> = {};
        section.fields.forEach((field) => {
          const autoValue = getAutoPrefillValue(field, section.id);

          switch (field.type) {
            case "multi-select":
            case "checkbox-group":
              itemValues[field.id] = Array.isArray(autoValue)
                ? autoValue
                : autoValue
                ? [autoValue]
                : [];
              break;
            case "boolean":
            case "checkbox":
              itemValues[field.id] = Boolean(autoValue);
              break;
            case "number":
              itemValues[field.id] =
                autoValue !== undefined && autoValue !== null
                  ? autoValue
                  : typeof field.min === "number"
                  ? field.min
                  : null;
              break;
            case "photo":
            case "photo-multi":
              itemValues[field.id] = [];
              break;
            default:
              itemValues[field.id] =
                autoValue !== undefined && autoValue !== null ? autoValue : "";
          }
        });
        return itemValues;
      });
      return acc;
    }

    const sectionValues: Record<string, any> = {};
    section.fields.forEach((field) => {
      if (field.type === "table") {
        const explicitDefault = (field as any).defaultValue;
        if (hasMeaningfulDefault(explicitDefault)) {
          sectionValues[field.id] = explicitDefault;
        } else {
          const columns =
            field.columns || (field as any).metadata?.columns || [];
          const placeholderRow = buildTablePlaceholderRow(
            columns,
            today,
            template,
            field.id
          );
          sectionValues[field.id] = placeholderRow ? [placeholderRow] : [];
        }
        return;
      }

      const autoValue = getAutoPrefillValue(field, section.id);

      switch (field.type) {
        case "multi-select":
        case "checkbox-group":
          if (Array.isArray(autoValue) && autoValue.length) {
            sectionValues[field.id] = autoValue;
          } else if (autoValue !== undefined && autoValue !== null) {
            sectionValues[field.id] = Array.isArray(autoValue)
              ? autoValue
              : [autoValue];
          } else {
            sectionValues[field.id] = (field.options || []).map(
              (option) => option.value
            );
          }
          break;
        case "boolean":
        case "checkbox":
          sectionValues[field.id] =
            autoValue !== undefined && autoValue !== null
              ? Boolean(autoValue)
              : true;
          break;
        case "number":
          if (autoValue !== undefined && autoValue !== null) {
            sectionValues[field.id] = autoValue;
          } else if (typeof field.min === "number") {
            sectionValues[field.id] = field.min;
          } else {
            sectionValues[field.id] = 1;
          }
          break;
        case "photo":
        case "photo-multi":
          sectionValues[field.id] = autoValue ?? [];
          break;
        default:
          sectionValues[field.id] =
            autoValue !== undefined && autoValue !== null ? autoValue : "";
      }
    });
    acc[section.id] = sectionValues;
    return acc;
  }, {} as InspectionFormValues);
};

const JobCompletionModal: React.FC<JobCompletionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  jobId,
  jobType,
  job,
}) => {
  // Log jobId when modal is opened
  React.useEffect(() => {
    if (visible) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(jobId || "");
      console.log("[JobCompletionModal] Modal opened with:", {
        jobId: jobId,
        jobIdType: typeof jobId,
        jobIdLength: jobId?.length,
        isValidObjectId: isValidObjectId,
        jobType: jobType,
      });

      if (!isValidObjectId) {
        console.warn(
          "[JobCompletionModal] WARNING: Received invalid ObjectId format:",
          jobId
        );
      }
    }
  }, [visible, jobId, jobType]);

  // Job completion validation function
  const canCompleteJob = () => {
    if (!job) return true; // If no job data provided, assume it can be completed (fallback)

    // Only scheduled or in progress jobs can be completed
    if (job.status !== "Scheduled" && job.status !== "In Progress") {
      return false;
    }

    // Check if job is due (due date is today or past)
    const today = new Date();
    const dueDate = new Date(job.dueDate);
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate <= today;
  };

  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const steps = useMemo(() => getStepsForJobType(jobType), [jobType]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<InspectionTemplate | null>(null);

  // Room configuration state for MinimumSafetyStandard
  const [bedroomCount, setBedroomCount] = useState(1);
  const [bathroomCount, setBathroomCount] = useState(1);
  const [loadingDynamicTemplate, setLoadingDynamicTemplate] = useState(false);
  const [formValues, setFormValues] = useState<InspectionFormValues>({});
  const [mediaByField, setMediaByField] = useState<
    Record<string, InspectionMediaUpload[]>
  >({});
  const [notes, setNotes] = useState("");
  const [inspectionReportId, setInspectionReportId] = useState<string | null>(
    null
  );
  const [inspectionReportUrl, setInspectionReportUrl] = useState<
    string | undefined
  >(undefined);
  const [jobCompletionCommitted, setJobCompletionCommitted] = useState(false);

  const [hasInvoice, setHasInvoice] = useState(false);
  const [invoiceDescription, setInvoiceDescription] = useState("Safety inspection and compliance check for rental property");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: `${Date.now()}`,
      name: "Gas Safety Inspection Service",
      quantity: 1,
      rate: 150.00,
      amount: 150.00,
    },
  ]);
  const [taxPercentage, setTaxPercentage] = useState(10);
  const [invoiceNotes, setInvoiceNotes] = useState("Payment due within 30 days of completion");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setCurrentStepIndex(0);
    setTemplates([]);
    setSelectedTemplate(null);
    setFormValues({});
    setMediaByField({});
    setNotes("");
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
    setJobCompletionCommitted(false);
    setHasInvoice(false);
    setInvoiceDescription("Gas safety inspection and compliance check for rental property");
    setLineItems([{
      id: `${Date.now()}`,
      name: "Gas Safety Inspection Service",
      quantity: 1,
      rate: 150.00,
      amount: 150.00,
    }]);
    setTaxPercentage(10);
    setInvoiceNotes("Payment due within 30 days of completion");
    setTemplateError(null);
    setLoadingTemplates(false);
    setJobDetails(null);
    setLoadingJobDetails(false);
    setBedroomCount(1);
    setBathroomCount(1);
    setLoadingDynamicTemplate(false);
  };

  const applyTemplatePrefill = (templateToApply: InspectionTemplate) => {
    setSelectedTemplate(templateToApply);
    setFormValues(initializeFormValues(templateToApply, jobDetails));
    setMediaByField(generateMediaPrefillForTemplate(templateToApply));
    setNotes(__DEV__ ? DEFAULT_TEST_NOTES : "");
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
    setJobCompletionCommitted(false);
  };

  useEffect(() => {
    if (visible) {
      loadJobDetails();
      loadTemplates();
    } else {
      resetState();
    }
  }, [visible]);

  // Re-initialize form values when both template and job details are loaded
  useEffect(() => {
    if (selectedTemplate && jobDetails && visible) {
      console.log("[JobCompletionModal] Re-initializing form with job data");
      const initialValues = initializeFormValues(selectedTemplate, jobDetails);
      setFormValues(initialValues);
    }
  }, [selectedTemplate, jobDetails, visible]);

  const loadJobDetails = async () => {
    try {
      setLoadingJobDetails(true);
      console.log("[JobCompletionModal] Fetching job details for jobId:", jobId);
      const details = await fetchJobDetails(jobId);
      console.log("[JobCompletionModal] Job details loaded:", details);
      setJobDetails(details);
    } catch (error) {
      console.error("[JobCompletionModal] Failed to load job details:", error);
      // Don't show error to user, just continue without pre-filled data
    } finally {
      setLoadingJobDetails(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);
      // Clear any stale template data before loading fresh results
      setTemplates([]);
      setSelectedTemplate(null);
      setFormValues({});

      if (isGasJobType(jobType)) {
        try {
          const jobTemplateResponse = await fetchJobInspectionTemplate(jobId);
          const gasTemplate = jobTemplateResponse.template;

          setJobDetails((prev: any) => ({
            ...(prev || {}),
            property: {
              ...(prev?.property || {}),
              ...(jobTemplateResponse.property || {}),
            },
            assignedTechnician: jobTemplateResponse.technician
              ? {
                  firstName: jobTemplateResponse.technician.firstName,
                  lastName: jobTemplateResponse.technician.lastName,
                  email: jobTemplateResponse.technician.email,
                  phone: jobTemplateResponse.technician.phone,
                  licenseNumber: jobTemplateResponse.technician.licenseNumber,
                }
              : prev?.assignedTechnician,
            status: jobTemplateResponse.job?.status || prev?.status,
            dueDate: jobTemplateResponse.job?.dueDate || prev?.dueDate,
          }));

          setTemplates([gasTemplate]);
          applyTemplatePrefill(gasTemplate);
          return;
        } catch (gasTemplateError) {
          console.warn(
            "[JobCompletionModal] Falling back to generic template loading for gas job",
            gasTemplateError
          );
        }
      }

      const fetched = await fetchInspectionTemplates();

      // Show all templates sorted by jobType and version
      // This allows technicians to choose any template regardless of job type
      const sortedTemplates = [...fetched].sort((a, b) => {
        // First sort by jobType alphabetically
        const jobTypeCompare = a.jobType.localeCompare(b.jobType);
        if (jobTypeCompare !== 0) return jobTypeCompare;
        // Then by version (highest first) within same jobType
        return (b.version || 0) - (a.version || 0);
      });

      console.log(
        `[JobCompletionModal] Loaded ${sortedTemplates.length} templates (all templates shown)`
      );

      setTemplates(sortedTemplates);
    } catch (error: any) {
      console.error("Failed to load templates", error);
      setTemplateError(error?.message || "Unable to load inspection templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const goToStep = (stepIndex: number) => {
    const boundedIndex = Math.min(Math.max(stepIndex, 0), steps.length - 1);
    if (boundedIndex !== currentStepIndex) {
      if (boundedIndex < currentStepIndex) {
        // Navigating backwards invalidates generated report snapshot
        setInspectionReportId(null);
        setInspectionReportUrl(undefined);
      }
      setCurrentStepIndex(boundedIndex);
    }
  };

  const handleTemplateContinue = () => {
    if (!selectedTemplate) {
      Alert.alert(
        "Select Template",
        "Please choose an inspection template to continue."
      );
      return;
    }

    // For MinimumSafetyStandard, go to room configuration step
    if (selectedTemplate.jobType === "MinimumSafetyStandard") {
      goToStep(1); // Go to room configuration step
    } else {
      // For other templates, initialize form and go directly to form step
      if (Object.keys(formValues).length === 0) {
        setFormValues(initializeFormValues(selectedTemplate, jobDetails));
      }
      const formStepIndex = steps.findIndex((step) => step.key === "form");
      goToStep(formStepIndex);
    }
  };

  const handleRoomConfigContinue = async () => {
    if (
      !selectedTemplate ||
      selectedTemplate.jobType !== "MinimumSafetyStandard"
    ) {
      Alert.alert("Error", "Invalid template for room configuration.");
      return;
    }

    if (bedroomCount < 1 || bathroomCount < 1) {
      Alert.alert(
        "Invalid Configuration",
        "Please enter at least 1 bedroom and 1 bathroom."
      );
      return;
    }

    try {
      setLoadingDynamicTemplate(true);

      // Fetch the dynamic template with room counts
      const dynamicTemplate = await fetchInspectionTemplate(
        "MinimumSafetyStandard",
        {
          bedroomCount,
          bathroomCount,
        }
      );

      applyTemplatePrefill(dynamicTemplate);

      const nextStepIndex = steps.findIndex((step) => step.key === "form");
      goToStep(nextStepIndex);
    } catch (error: any) {
      console.error("Failed to load dynamic template:", error);
      Alert.alert(
        "Template Error",
        error?.message ||
          "Failed to load the inspection template. Please try again."
      );
    } finally {
      setLoadingDynamicTemplate(false);
    }
  };

  const handleFormContinue = () => {
    if (!selectedTemplate) {
      Alert.alert("Template missing", "Select a template before proceeding.");
      return;
    }
    const missing = validateRequiredFields(
      selectedTemplate,
      formValues,
      mediaByField
    );
    if (missing.length) {
      Alert.alert(
        "Incomplete form",
        `Please complete required fields: ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? "…" : ""
        }`
      );
      return;
    }
    const nextStepIndex = steps.findIndex((step) => step.key === "invoice");
    goToStep(nextStepIndex);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      Alert.alert("Template missing", "Select a template before submitting.");
      return;
    }
    const gasV3Submission = isGasTemplateV3(selectedTemplate);
    const missing = validateRequiredFields(
      selectedTemplate,
      formValues,
      mediaByField
    );
    if (missing.length) {
      Alert.alert(
        "Incomplete form",
        `Please complete required fields: ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? "…" : ""
        }`
      );
      goToStep(1);
      return;
    }

    if (hasInvoice && !invoiceDescription.trim()) {
      Alert.alert("Invoice required", "Please enter an invoice description.");
      return;
    }

    if (hasInvoice) {
      const validItems = lineItems.filter(
        (item) => item.name.trim() && item.quantity > 0 && item.rate > 0
      );
      if (validItems.length === 0) {
        Alert.alert(
          "Invoice items",
          "Add at least one line item with name, quantity, and rate."
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Validate if job can be completed BEFORE creating inspection report
      if (
        !jobCompletionCommitted &&
        job?.status !== "Completed" &&
        !canCompleteJob()
      ) {
        const today = new Date();
        const dueDate = job ? new Date(job.dueDate) : today;
        const isNotDue = dueDate > today;

        if (isNotDue) {
          Alert.alert(
            "Job Not Due",
            `This job can only be completed on or after ${dueDate.toLocaleDateString()}. Please wait until the due date to complete this job.`
          );
        } else if (
          job &&
          job.status !== "Scheduled" &&
          job.status !== "In Progress"
        ) {
          Alert.alert(
            "Invalid Job Status",
            `Only scheduled or in-progress jobs can be completed. Current status: ${job.status}`
          );
        } else {
          Alert.alert(
            "Cannot Complete Job",
            "This job cannot be completed at this time."
          );
        }
        return;
      }

      let reportId = inspectionReportId;
      let reportUrl = inspectionReportUrl;

      const completionPayload: JobCompletionData = {
        hasInvoice,
      };

      if (hasInvoice) {
        const { subtotal, taxAmount, total } = calculateTotals();
        const validLineItems = lineItems
          .filter(
            (item) => item.name.trim() && item.quantity > 0 && item.rate > 0
          )
          .map((item) => ({
            ...item,
            name: item.name.trim(),
          }));

        completionPayload.invoiceData = {
          description: invoiceDescription.trim(),
          lineItems: validLineItems,
          taxPercentage,
          subtotal,
          taxAmount,
          total,
          notes: invoiceNotes.trim() || undefined,
        } as InvoiceData;
      }

      if (gasV3Submission) {
        if (!jobCompletionCommitted && job?.status !== "Completed") {
          await onSubmit(completionPayload);
          setJobCompletionCommitted(true);
        }

        if (!reportId) {
          const submission = await submitInspectionReport(jobId, {
            template: selectedTemplate,
            formValues,
            mediaByField,
            notes,
          });
          reportId = submission.report.id;
          reportUrl = submission.pdf?.url;
          setInspectionReportId(reportId);
          setInspectionReportUrl(reportUrl);
        }
      } else {
        if (!reportId) {
          const submission = await submitInspectionReport(jobId, {
            template: selectedTemplate,
            formValues,
            mediaByField,
            notes,
          });
          reportId = submission.report.id;
          reportUrl = submission.pdf?.url;
          setInspectionReportId(reportId);
          setInspectionReportUrl(reportUrl);
        }

        completionPayload.inspectionReportId = reportId || undefined;
        await onSubmit(completionPayload);
      }

      Alert.alert(
        "Success",
        reportUrl
          ? "Inspection submitted and job completed successfully."
          : "Job completed successfully."
      );
      onClose();
    } catch (error: any) {
      console.log(error, "Error...RentalEase");
      console.error("Job completion failed", error);
      Alert.alert(
        "Unable to complete job",
        gasV3Submission && jobCompletionCommitted
          ? `The job was completed, but the gas report submission failed. ${error?.message || "Please retry the report submission."}`
          : error?.message || "Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSelect = (template: InspectionTemplate) => {
    applyTemplatePrefill(template);
  };

  const handleValueChange = (
    sectionId: string,
    fieldId: string,
    value: any,
    itemIndex?: number
  ) => {
    setFormValues((prev) => {
      if (itemIndex === undefined) {
        return {
          ...prev,
          [sectionId]: {
            ...(prev[sectionId] || {}),
            [fieldId]: value,
          },
        };
      }

      const currentItems = Array.isArray(prev[sectionId]) ? prev[sectionId] : [];
      const nextItems = currentItems.map((item, index) =>
        index === itemIndex ? { ...(item || {}), [fieldId]: value } : item
      );

      return {
        ...prev,
        [sectionId]: nextItems,
      };
    });
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
  };

  const handleAddMedia = (
    sectionId: string,
    fieldId: string,
    media: InspectionMediaUpload,
    itemIndex?: number
  ) => {
    const storageKey = getMediaStorageKey(sectionId, fieldId, itemIndex);
    setMediaByField((prev) => {
      const nextItems = [...(prev[storageKey] || []), media];

      setFormValues((currentValues) => {
        if (itemIndex === undefined) {
          return {
            ...currentValues,
            [sectionId]: {
              ...(currentValues[sectionId] || {}),
              [fieldId]: nextItems.map((item) => item.name || item.uri),
            },
          };
        }

        const currentSectionItems = Array.isArray(currentValues[sectionId])
          ? currentValues[sectionId]
          : [];
        const updatedSectionItems = currentSectionItems.map((item, index) =>
          index === itemIndex
            ? {
                ...(item || {}),
                [fieldId]: nextItems.map((entry) => entry.name || entry.uri),
              }
            : item
        );

        return {
          ...currentValues,
          [sectionId]: updatedSectionItems,
        };
      });

      return {
        ...prev,
        [storageKey]: nextItems,
      };
    });
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
  };

  const handleRemoveMedia = (
    sectionId: string,
    fieldId: string,
    index: number,
    itemIndex?: number
  ) => {
    const storageKey = getMediaStorageKey(sectionId, fieldId, itemIndex);
    setMediaByField((prev) => {
      const nextItems = (prev[storageKey] || []).filter((_, i) => i !== index);

      setFormValues((currentValues) => {
        if (itemIndex === undefined) {
          return {
            ...currentValues,
            [sectionId]: {
              ...(currentValues[sectionId] || {}),
              [fieldId]: nextItems.map((item) => item.name || item.uri),
            },
          };
        }

        const currentSectionItems = Array.isArray(currentValues[sectionId])
          ? currentValues[sectionId]
          : [];
        const updatedSectionItems = currentSectionItems.map((item, currentIndex) =>
          currentIndex === itemIndex
            ? {
                ...(item || {}),
                [fieldId]: nextItems.map((entry) => entry.name || entry.uri),
              }
            : item
        );

        return {
          ...currentValues,
          [sectionId]: updatedSectionItems,
        };
      });

      return {
        ...prev,
        [storageKey]: nextItems,
      };
    });
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
  };

  const handleAddRepeatableItem = (sectionId: string) => {
    const section = selectedTemplate?.sections.find((entry) => entry.id === sectionId);
    if (!section?.repeatable) {
      return;
    }

    setFormValues((prev) => {
      const currentItems = Array.isArray(prev[sectionId]) ? prev[sectionId] : [];
      const newItem = section.fields.reduce((acc: Record<string, any>, field) => {
        if (field.type === "multi-select" || field.type === "checkbox-group") {
          acc[field.id] = [];
        } else if (field.type === "boolean" || field.type === "checkbox") {
          acc[field.id] = false;
        } else if (field.type === "photo" || field.type === "photo-multi") {
          acc[field.id] = [];
        } else {
          acc[field.id] = "";
        }
        return acc;
      }, {});

      return {
        ...prev,
        [sectionId]: [...currentItems, newItem],
      };
    });
    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
  };

  const handleRemoveRepeatableItem = (sectionId: string, itemIndex: number) => {
    const section = selectedTemplate?.sections.find((entry) => entry.id === sectionId);
    const minimumItems = section?.minItems || 0;

    setFormValues((prev) => {
      const currentItems = Array.isArray(prev[sectionId]) ? prev[sectionId] : [];
      if (currentItems.length <= minimumItems) {
        return prev;
      }

      return {
        ...prev,
        [sectionId]: currentItems.filter((_: any, index: number) => index !== itemIndex),
      };
    });

    setMediaByField((prev) => {
      const next = { ...prev };
      Object.keys(prev).forEach((key) => {
        const match = key.match(new RegExp(`^${sectionId}__(\\d+)__(.+)$`));
        if (!match) {
          return;
        }

        const keyIndex = Number(match[1]);
        const fieldId = match[2];
        if (keyIndex === itemIndex) {
          delete next[key];
          return;
        }
        if (keyIndex > itemIndex) {
          const nextKey = getMediaStorageKey(sectionId, fieldId, keyIndex - 1);
          next[nextKey] = prev[key];
          delete next[key];
        }
      });
      return next;
    });

    setInspectionReportId(null);
    setInspectionReportUrl(undefined);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxPercentage) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const updateLineItem = (
    id: string,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            const quantity = Number(updated.quantity) || 0;
            const rate = Number(updated.rate) || 0;
            updated.amount = quantity * rate;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, defaultLineItem()]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) =>
      prev.length === 1 ? prev : prev.filter((item) => item.id !== id)
    );
  };

  const renderStepContent = () => {
    if (loadingTemplates) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loaderText, { color: theme.textSecondary }]}>
            Loading templates…
          </Text>
        </View>
      );
    }

    if (templateError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            {templateError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={loadTemplates}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const stepKey: StepKey = steps[currentStepIndex].key;

    switch (stepKey) {
      case "template":
        return (
          <ScrollView style={styles.stepScroll}>
            <Text style={[styles.stepHeading, { color: theme.text }]}>
              Choose inspection template
            </Text>
            <Text
              style={[styles.stepSubheading, { color: theme.textSecondary }]}
            >
              Select the form that matches the work carried out on this job.
            </Text>
            <View style={styles.templateGrid}>
              {templates.map((template) => {
                const isSelected =
                  selectedTemplate?.jobType === template.jobType &&
                  selectedTemplate?.version === template.version;
                const highlight = isSelected;
                return (
                  <TouchableOpacity
                    key={`${template.jobType}-${template.version}`}
                    style={[
                      styles.templateCard,
                      {
                        borderColor: highlight ? theme.primary : theme.border,
                        backgroundColor: highlight
                          ? theme.primary + "10"
                          : theme.card,
                      },
                    ]}
                    onPress={() => handleTemplateSelect(template)}
                  >
                    <View style={styles.templateHeader}>
                      <MaterialCommunityIcons
                        name={isSelected ? "clipboard-check" : "clipboard-text"}
                        size={24}
                        color={highlight ? theme.primary : theme.textSecondary}
                      />
                      <Text
                        style={[styles.templateJobType, { color: theme.text }]}
                      >
                        {formatJobType(template.jobType)}
                      </Text>
                    </View>
                    <Text style={[styles.templateTitle, { color: theme.text }]}>
                      {template.title}
                    </Text>
                    {template.metadata?.summary && (
                      <Text
                        style={[
                          styles.templateSummary,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {template.metadata.summary}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {templates.length === 0 && (
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  No templates configured yet.
                </Text>
              )}
            </View>
          </ScrollView>
        );
      case "rooms":
        if (loadingDynamicTemplate) {
          return (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loaderText, { color: theme.textSecondary }]}>
                Loading inspection template…
              </Text>
            </View>
          );
        }
        return (
          <ScrollView style={styles.stepScroll}>
            <Text style={[styles.stepHeading, { color: theme.text }]}>
              Property Configuration
            </Text>
            <Text
              style={[styles.stepSubheading, { color: theme.textSecondary }]}
            >
              Configure the number of bedrooms and bathrooms for this property
              inspection.
            </Text>
            <View
              style={[
                styles.roomConfigCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.roomConfigRow}>
                <View style={styles.roomConfigItem}>
                  <Text style={[styles.roomConfigLabel, { color: theme.text }]}>
                    Number of Bedrooms
                  </Text>
                  <Text
                    style={[
                      styles.roomConfigHint,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Enter the total number of bedrooms
                  </Text>
                  <View style={styles.roomCounterContainer}>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() =>
                        setBedroomCount(Math.max(1, bedroomCount - 1))
                      }
                      disabled={bedroomCount <= 1}
                    >
                      <MaterialCommunityIcons
                        name="minus"
                        size={20}
                        color={
                          bedroomCount <= 1
                            ? theme.textTertiary
                            : theme.textSecondary
                        }
                      />
                    </TouchableOpacity>
                    <Text style={[styles.counterValue, { color: theme.text }]}>
                      {bedroomCount}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() =>
                        setBedroomCount(Math.min(20, bedroomCount + 1))
                      }
                      disabled={bedroomCount >= 20}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={20}
                        color={
                          bedroomCount >= 20
                            ? theme.textTertiary
                            : theme.textSecondary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.roomConfigItem}>
                  <Text style={[styles.roomConfigLabel, { color: theme.text }]}>
                    Number of Bathrooms
                  </Text>
                  <Text
                    style={[
                      styles.roomConfigHint,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Enter the total number of bathrooms
                  </Text>
                  <View style={styles.roomCounterContainer}>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() =>
                        setBathroomCount(Math.max(1, bathroomCount - 1))
                      }
                      disabled={bathroomCount <= 1}
                    >
                      <MaterialCommunityIcons
                        name="minus"
                        size={20}
                        color={
                          bathroomCount <= 1
                            ? theme.textTertiary
                            : theme.textSecondary
                        }
                      />
                    </TouchableOpacity>
                    <Text style={[styles.counterValue, { color: theme.text }]}>
                      {bathroomCount}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() =>
                        setBathroomCount(Math.min(10, bathroomCount + 1))
                      }
                      disabled={bathroomCount >= 10}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={20}
                        color={
                          bathroomCount >= 10
                            ? theme.textTertiary
                            : theme.textSecondary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        );
      case "form":
        if (!selectedTemplate) {
          return (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.error }]}>
                Select a template to continue.
              </Text>
            </View>
          );
        }
        return (
          <ScrollView style={styles.stepScroll}>
            <View
              style={[
                styles.infoCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                {selectedTemplate.title}
              </Text>
              <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
                {`Job Type: ${selectedTemplate.jobType} · Version ${selectedTemplate.version}`}
              </Text>
            </View>
            <InspectionForm
              template={selectedTemplate}
              values={formValues}
              mediaByField={mediaByField}
              onChange={handleValueChange}
              onAddMedia={handleAddMedia}
              onRemoveMedia={handleRemoveMedia}
              onAddRepeatableItem={handleAddRepeatableItem}
              onRemoveRepeatableItem={handleRemoveRepeatableItem}
              notes={notes}
              onNotesChange={(val) => {
                setNotes(val);
                setInspectionReportId(null);
                setInspectionReportUrl(undefined);
              }}
            />
          </ScrollView>
        );
      case "invoice":
      default:
        const { subtotal, taxAmount, total } = calculateTotals();
        return (
          <ScrollView style={styles.stepScroll}>
            {inspectionReportId && (
              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons
                    name="file-check"
                    size={20}
                    color={theme.success || "#10B981"}
                  />
                  <Text style={[styles.infoTitle, { color: theme.text }]}>
                    Inspection saved
                  </Text>
                </View>
                <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
                  {inspectionReportUrl
                    ? "A PDF report has been generated and linked to this job."
                    : "Inspection data is ready for submission."}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.toggleCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Attach Invoice
                </Text>
                <Text
                  style={[
                    styles.sectionDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  Generate an invoice for additional charges or materials.
                </Text>
              </View>
              <Switch
                value={hasInvoice}
                onValueChange={setHasInvoice}
                trackColor={{ false: theme.textTertiary, true: theme.primary }}
                thumbColor={hasInvoice ? theme.surface : theme.textSecondary}
              />
            </View>

            {hasInvoice && (
              <View
                style={[
                  styles.invoiceContainer,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Invoice Details
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Description *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { borderColor: theme.border, color: theme.text },
                    ]}
                    value={invoiceDescription}
                    onChangeText={setInvoiceDescription}
                    placeholder="Enter invoice description"
                    placeholderTextColor={theme.placeholder}
                    multiline
                  />
                </View>

                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.text, marginTop: 12 },
                  ]}
                >
                  Line Items
                </Text>
                {lineItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.lineItemCard, { borderColor: theme.border }]}
                  >
                    <View style={styles.lineItemHeader}>
                      <Text
                        style={[styles.lineItemTitle, { color: theme.text }]}
                      >
                        {`Item ${index + 1}`}
                      </Text>
                      {lineItems.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeLineItem(item.id)}
                        >
                          <MaterialCommunityIcons
                            name="delete-outline"
                            size={20}
                            color={theme.error}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Name *
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          { borderColor: theme.border, color: theme.text },
                        ]}
                        value={item.name}
                        onChangeText={(text) =>
                          updateLineItem(item.id, "name", text)
                        }
                        placeholder="Line item description"
                        placeholderTextColor={theme.placeholder}
                      />
                    </View>
                    <View style={styles.lineItemRow}>
                      <View style={styles.lineItemInputSmall}>
                        <Text
                          style={[styles.inputLabel, { color: theme.text }]}
                        >
                          Qty *
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            { borderColor: theme.border, color: theme.text },
                          ]}
                          value={String(item.quantity)}
                          keyboardType="numeric"
                          onChangeText={(text) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              parseInt(text, 10) || 0
                            )
                          }
                          placeholder="1"
                          placeholderTextColor={theme.placeholder}
                        />
                      </View>
                      <View style={styles.lineItemInputSmall}>
                        <Text
                          style={[styles.inputLabel, { color: theme.text }]}
                        >
                          Rate *
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            { borderColor: theme.border, color: theme.text },
                          ]}
                          value={String(item.rate)}
                          keyboardType="decimal-pad"
                          onChangeText={(text) =>
                            updateLineItem(
                              item.id,
                              "rate",
                              parseFloat(text) || 0
                            )
                          }
                          placeholder="0.00"
                          placeholderTextColor={theme.placeholder}
                        />
                      </View>
                      <View style={styles.lineItemInputSmall}>
                        <Text
                          style={[styles.inputLabel, { color: theme.text }]}
                        >
                          Amount
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            { borderColor: theme.border, color: theme.text },
                          ]}
                          value={`$${item.amount.toFixed(2)}`}
                          editable={false}
                        />
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={addLineItem}
                >
                  <MaterialCommunityIcons
                    name="plus-circle"
                    size={18}
                    color={theme.primary}
                  />
                  <Text style={[styles.addItemText, { color: theme.primary }]}>
                    Add line item
                  </Text>
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Tax %
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { borderColor: theme.border, color: theme.text },
                    ]}
                    value={String(taxPercentage)}
                    keyboardType="numeric"
                    onChangeText={(text) =>
                      setTaxPercentage(parseFloat(text) || 0)
                    }
                    placeholder="10"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Subtotal
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    ${subtotal.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Tax
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    ${taxAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      styles.summaryTotal,
                      { color: theme.text },
                    ]}
                  >
                    Total
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      styles.summaryTotal,
                      { color: theme.text },
                    ]}
                  >
                    ${total.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Notes
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { borderColor: theme.border, color: theme.text },
                    ]}
                    value={invoiceNotes}
                    onChangeText={setInvoiceNotes}
                    placeholder="Optional notes"
                    placeholderTextColor={theme.placeholder}
                    multiline
                  />
                </View>
              </View>
            )}
          </ScrollView>
        );
    }
  };

  const renderFooterActions = () => {
    const stepKey: StepKey = steps[currentStepIndex].key;

    const primaryLabel =
      stepKey === "template"
        ? "Continue"
        : stepKey === "rooms"
        ? "Generate Template"
        : stepKey === "form"
        ? "Continue"
        : "Complete Job";

    const primaryAction =
      stepKey === "template"
        ? handleTemplateContinue
        : stepKey === "rooms"
        ? handleRoomConfigContinue
        : stepKey === "form"
        ? handleFormContinue
        : handleSubmit;

    return (
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerSecondary}
          onPress={onClose}
          disabled={isSubmitting}
        >
          <Text
            style={[styles.footerSecondaryText, { color: theme.textSecondary }]}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        {currentStepIndex > 0 && (
          <TouchableOpacity
            style={styles.footerSecondary}
            onPress={() => goToStep(currentStepIndex - 1)}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.footerSecondaryText,
                { color: theme.textSecondary },
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.footerPrimary,
            {
              backgroundColor: theme.primary,
              opacity: isSubmitting || loadingDynamicTemplate ? 0.7 : 1,
            },
          ]}
          onPress={primaryAction}
          disabled={isSubmitting || loadingDynamicTemplate}
        >
          {isSubmitting || loadingDynamicTemplate ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.footerPrimaryText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Complete Job
          </Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.stepIndicator}>
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            return (
              <View key={step.key} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor:
                        isCompleted || isActive ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={styles.stepCircleText}>{index + 1}</Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: isActive ? theme.primary : theme.textSecondary,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.content}>{renderStepContent()}</View>
        {renderFooterActions()}
      </View>
    </Modal>
  );
};

const validateRequiredFields = (
  template: InspectionTemplate,
  values: InspectionFormValues,
  media: Record<string, InspectionMediaUpload[]>
): string[] => {
  const missing: string[] = [];
  const isFieldVisible = (
    field: InspectionField,
    scopeValues: Record<string, any>
  ) => {
    const visibleWhen = field.metadata?.visibleWhen;
    if (!visibleWhen) {
      return true;
    }
    if (visibleWhen.equals !== undefined) {
      return scopeValues?.[visibleWhen.fieldId] === visibleWhen.equals;
    }
    return true;
  };

  const validateFieldValue = (
    sectionId: string,
    field: InspectionField,
    scopeValues: Record<string, any>,
    itemIndex?: number
  ) => {
    if (!field.required || field.metadata?.readOnly || field.metadata?.systemCalculated) {
      return;
    }
    if (!isFieldVisible(field, scopeValues)) {
      return;
    }

    const labelPrefix =
      itemIndex === undefined
        ? getFieldLabel(field)
        : `${template.sections.find((section) => section.id === sectionId)?.itemLabel || "Item"} ${itemIndex + 1}: ${getFieldLabel(field)}`;
    const value = scopeValues[field.id];

    if (field.type === "photo" || field.type === "photo-multi") {
      const attachments = media[getMediaStorageKey(sectionId, field.id, itemIndex)] || [];
      if (!attachments.length) {
        missing.push(labelPrefix);
      }
      return;
    }

    if (field.type === "table") {
      const rows = Array.isArray(value) ? value : [];
      if (!rows.length) {
        missing.push(labelPrefix);
        return;
      }
      const requiredColumns = field.columns?.filter((column) => column.required);
      if (requiredColumns && requiredColumns.length) {
        const hasIncompleteRow = rows.some((row: Record<string, any>) =>
          requiredColumns.some(
            (column) =>
              row[column.id] === undefined ||
              row[column.id] === null ||
              row[column.id] === ""
          )
        );
        if (hasIncompleteRow) {
          missing.push(`${labelPrefix} (complete required columns)`);
        }
      }
      return;
    }

    if (value === undefined || value === null || value === "") {
      missing.push(labelPrefix);
      return;
    }
    if (Array.isArray(value) && value.length === 0) {
      missing.push(labelPrefix);
    }
  };

  template.sections.forEach((section) => {
    if (section.repeatable) {
      const items = Array.isArray(values[section.id]) ? values[section.id] : [];
      if (!items.length && (section.minItems || 0) > 0) {
        missing.push(section.title);
        return;
      }

      items.forEach((item: Record<string, any>, itemIndex: number) => {
        section.fields.forEach((field) =>
          validateFieldValue(section.id, field, item || {}, itemIndex)
        );
      });
      return;
    }

    const sectionValues = values[section.id] || {};
    section.fields.forEach((field) =>
      validateFieldValue(section.id, field, sectionValues)
    );
  });
  return missing;
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
    },
    stepIndicator: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? theme.surface : theme.background,
    },
    stepItem: {
      alignItems: "center",
      flex: 1,
    },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    stepCircleText: {
      color: "#fff",
      fontWeight: "700",
    },
    stepLabel: {
      fontSize: 12,
      textAlign: "center",
    },
    content: {
      flex: 1,
      padding: 20,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 40,
    },
    loaderText: {
      marginTop: 12,
      fontSize: 14,
    },
    errorContainer: {
      alignItems: "center",
      paddingVertical: 40,
    },
    errorText: {
      fontSize: 14,
      marginBottom: 16,
      textAlign: "center",
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryText: {
      color: "#fff",
      fontWeight: "600",
    },
    stepScroll: {
      flex: 1,
    },
    stepHeading: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    stepSubheading: {
      fontSize: 14,
      marginBottom: 16,
    },
    templateGrid: {
      gap: 12,
    },
    templateCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
    },
    templateHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    templateJobType: {
      fontSize: 16,
      fontWeight: "600",
    },
    templateTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 6,
    },
    templateMeta: {
      fontSize: 12,
    },
    templateSummary: {
      fontSize: 12,
      marginTop: 4,
    },
    emptyText: {
      textAlign: "center",
      marginTop: 24,
    },
    infoCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: "700",
    },
    infoSub: {
      fontSize: 13,
      marginTop: 4,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    toggleCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    sectionDescription: {
      fontSize: 13,
      marginTop: 4,
    },
    invoiceContainer: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 16,
    },
    inputGroup: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    lineItemCard: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      gap: 12,
    },
    lineItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lineItemTitle: {
      fontSize: 14,
      fontWeight: "600",
    },
    lineItemRow: {
      flexDirection: "row",
      gap: 12,
    },
    lineItemInputSmall: {
      flex: 1,
    },
    addItemButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
    },
    addItemText: {
      fontWeight: "600",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    summaryLabel: {
      fontSize: 14,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "600",
    },
    summaryTotal: {
      fontSize: 15,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    footerSecondary: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footerSecondaryText: {
      fontWeight: "600",
    },
    footerPrimary: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    footerPrimaryText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    // Room configuration styles
    roomConfigCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 20,
      marginTop: 16,
    },
    roomConfigRow: {
      gap: 24,
    },
    roomConfigItem: {
      alignItems: "center",
    },
    roomConfigLabel: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
      textAlign: "center",
    },
    roomConfigHint: {
      fontSize: 13,
      marginBottom: 16,
      textAlign: "center",
    },
    roomCounterContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    counterButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    counterValue: {
      fontSize: 24,
      fontWeight: "700",
      minWidth: 40,
      textAlign: "center",
    },
  });

export { JobCompletionModal };
export default JobCompletionModal;
