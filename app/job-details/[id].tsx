import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { fetchJobDetails, claimJob, completeJob, Job } from "@services/jobs";
import { useTheme } from "../../contexts/ThemeContext";
import {
  JobCompletionModal,
  JobCompletionData,
} from "../../components/JobCompletionModal";

// Countdown Timer Component
const CountdownTimer = ({
  dueDate,
  status,
}: {
  dueDate: string;
  status: string;
}) => {
  const { theme } = useTheme();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const due = new Date(dueDate).getTime();

      // Handle invalid date
      if (isNaN(due)) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isOverdue: false,
        });
        return;
      }

      const difference = due - now;

      if (difference > 0) {
        // Job is not due yet
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isOverdue: false });
      } else {
        // Job is overdue
        const overdue = Math.abs(difference);
        const days = Math.floor(overdue / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (overdue % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((overdue % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isOverdue: true });
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [dueDate]);

  // Only show countdown for scheduled or in progress jobs
  if (status !== "Scheduled" && status !== "In Progress") {
    return null;
  }

  // Handle invalid date
  if (isNaN(new Date(dueDate).getTime())) {
    return (
      <View style={[styles.countdownCard, { backgroundColor: theme.card }]}>
        <View style={styles.countdownHeader}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={24}
            color={theme.error}
          />
          <Text style={[styles.countdownTitle, { color: theme.text }]}>
            INVALID DUE DATE
          </Text>
        </View>
        <Text style={[styles.countdownSubtext, { color: theme.textSecondary }]}>
          Please check the job due date
        </Text>
      </View>
    );
  }

  const formatTimeUnit = (value: number, unit: string) => {
    return `${value.toString().padStart(2, "0")}${unit}`;
  };

  const getCountdownColor = () => {
    if (timeLeft.isOverdue) {
      return theme.error;
    }
    if (timeLeft.days === 0 && timeLeft.hours < 24) {
      return theme.warning || "#F59E0B";
    }
    return theme.success;
  };

  const getCountdownText = () => {
    if (timeLeft.isOverdue) {
      return "OVERDUE";
    }
    return "DUE IN";
  };

  return (
    <View style={[styles.countdownCard, { backgroundColor: theme.card }]}>
      <View style={styles.countdownHeader}>
        <MaterialCommunityIcons
          name={timeLeft.isOverdue ? "alert-circle" : "clock-outline"}
          size={24}
          color={getCountdownColor()}
        />
        <Text style={[styles.countdownTitle, { color: theme.text }]}>
          {getCountdownText()}
        </Text>
      </View>

      <View style={styles.countdownTimer}>
        {timeLeft.days > 0 && (
          <View style={styles.timeUnit}>
            <Text style={[styles.timeValue, { color: getCountdownColor() }]}>
              {timeLeft.days}
            </Text>
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
              {timeLeft.days === 1 ? "DAY" : "DAYS"}
            </Text>
          </View>
        )}

        <View style={styles.timeUnit}>
          <Text style={[styles.timeValue, { color: getCountdownColor() }]}>
            {formatTimeUnit(timeLeft.hours, "")}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
            HOURS
          </Text>
        </View>

        <View style={styles.timeUnit}>
          <Text style={[styles.timeValue, { color: getCountdownColor() }]}>
            {formatTimeUnit(timeLeft.minutes, "")}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
            MINUTES
          </Text>
        </View>

        <View style={styles.timeUnit}>
          <Text style={[styles.timeValue, { color: getCountdownColor() }]}>
            {formatTimeUnit(timeLeft.seconds, "")}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
            SECONDS
          </Text>
        </View>
      </View>

      <Text style={[styles.countdownSubtext, { color: theme.textSecondary }]}>
        {timeLeft.isOverdue
          ? `Overdue by ${
              timeLeft.days > 0
                ? `${timeLeft.days} day${timeLeft.days > 1 ? "s" : ""} `
                : ""
            }${timeLeft.hours}h ${timeLeft.minutes}m`
          : `Due on ${new Date(dueDate).toLocaleDateString()}`}
      </Text>
    </View>
  );
};

// Helper Functions
const formatDate = (dateString: string) => {
  if (!dateString) return "Date not available";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid Date";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    Pending: { bg: "#FEF3C7", text: "#F59E0B" },
    Scheduled: { bg: "#DBEAFE", text: "#3B82F6" },
    "In Progress": { bg: "#D1FAE5", text: "#10B981" },
    Completed: { bg: "#F3F4F6", text: "#6B7280" },
  };
  return colors[status] || { bg: "#F3F4F6", text: "#6B7280" };
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    Low: { bg: "#D1FAE5", text: "#10B981" },
    Medium: { bg: "#FEF3C7", text: "#F59E0B" },
    High: { bg: "#FED7AA", text: "#F97316" },
    Critical: { bg: "#FEE2E2", text: "#EF4444" },
    Urgent: { bg: "#FEE2E2", text: "#EF4444" },
  };
  return colors[priority] || { bg: "#F3F4F6", text: "#6B7280" };
};

const getJobTypeIcon = (jobType: string) => {
  const icons: Record<string, string> = {
    Smoke: "smoke-detector",
    Gas: "gas-cylinder",
    Electrical: "lightning-bolt",
    Plumbing: "pipe-wrench",
    HVAC: "air-conditioner",
    "Routine Inspection": "clipboard-check",
    Repairs: "tools",
  };
  return icons[jobType] || "briefcase";
};

const getJobTitle = (job: Job) => {
  // If title exists, use it
  if (job.title) return job.title;

  // Get location info
  let location = "";
  if (job.property?.address) {
    if (typeof job.property.address === "string") {
      // Extract suburb or first part of address
      const parts = job.property.address.split(",");
      location = parts.length > 1 ? parts[1].trim() : parts[0].trim();
    } else {
      // Use suburb or street
      location = job.property.address.suburb || job.property.address.street || "";
    }
  }

  // Get property type for context
  const propertyType = job.property?.propertyType || "";

  // Generate title based on job type
  const jobTypeTitles: Record<string, string> = {
    "Smoke": "Smoke Alarm Inspection",
    "Gas": "Gas Safety Inspection",
    "Electrical": "Electrical Safety Check",
    "Plumbing": "Plumbing Inspection",
    "HVAC": "HVAC Maintenance",
    "Pool Safety": "Pool Safety Inspection",
    "Routine Inspection": "Property Inspection",
    "Repairs": "Property Repairs",
  };

  const baseTitle = jobTypeTitles[job.jobType] || `${job.jobType} Service`;

  // Add location or property type to make it more specific
  if (location) {
    return `${baseTitle} - ${location}`;
  } else if (propertyType) {
    return `${baseTitle} (${propertyType})`;
  }

  return baseTitle;
};

export default function JobDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingJob, setClaimingJob] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const loadJobDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      console.log("[JobDetails] Raw URL param id:", id);
      console.log("[JobDetails] ID type:", typeof id);
      console.log("[JobDetails] ID length:", id.length);
      console.log("[JobDetails] ID characters:", Array.from(id).join(", "));

      // Clean the ID - remove any extra characters
      const cleanId = Array.isArray(id) ? id[0] : id;
      console.log("[JobDetails] Loading job with cleaned ID:", cleanId);

      const jobData = await fetchJobDetails(cleanId);
      console.log(
        "[JobDetails] Received job data:",
        JSON.stringify(jobData, null, 2)
      );
      setJob(jobData);
    } catch (error: any) {
      console.log("[JobDetails] Error loading job:", error);
      Alert.alert("Error", error.message || "Failed to load job details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobDetails();
  }, [id]);

  const handleClaimJob = async () => {
    if (!job || claimingJob) return;

    Alert.alert("Claim Job", "Are you sure you want to claim this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Claim",
        onPress: async () => {
          try {
            setClaimingJob(true);
            console.log("[JobDetails] Claiming job:", job.id);
            await claimJob(job.id);
            console.log("[JobDetails] Job claimed successfully");
            Alert.alert("Success", "Job claimed successfully!", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (error: any) {
            console.log("[JobDetails] Error claiming job:", error);
            Alert.alert("Error", error.message || "Failed to claim job");
          } finally {
            setClaimingJob(false);
          }
        },
      },
    ]);
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleOpenReport = async (url: string) => {
    if (!url) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
        return;
      }

      Alert.alert(
        "Unable to open report",
        "We couldn't find an app to open this report link."
      );
    } catch (error) {
      console.log("[JobDetails] Error opening report:", error);
      Alert.alert("Error", "Failed to open the report. Please try again.");
    }
  };

  // Handle job completion
  const handleCompleteJob = async (completionData: JobCompletionData) => {
    console.log(job, "Job");
    if (!job) return;

    try {
      console.log("[JobDetails] Full job object:", JSON.stringify(job, null, 2));
      console.log(job, "Job Data...");

      // Always prioritize job.id (MongoDB ObjectId) over job_id (human-readable)
      const cleanId = Array.isArray(id) ? id[0] : id;
      const jobId = job.id || (job as any)._id || cleanId;
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(jobId);

      console.log("[JobDetails] ID Analysis:", {
        'job.id (MongoDB ObjectId)': job.id,
        'job.job_id (human-readable)': job.job_id,
        'job._id': (job as any)._id,
        urlParamId: id,
        cleanId: cleanId,
        finalJobId: jobId,
        jobIdLength: jobId?.length,
        isValidObjectId: isValidObjectId
      });

      if (!isValidObjectId) {
        console.error("[JobDetails] ERROR: Using invalid ObjectId format:", jobId);
        Alert.alert("Error", "Invalid job ID format. Please try again or contact support.");
        return;
      }

      console.log("[JobDetails] Completing job with data:", completionData);
      const result = await completeJob(jobId, completionData);
      console.log("[JobDetails] Job completed successfully:", result);

      // Update local job state
      setJob((prev) => (prev ? { ...prev, status: "Completed" } : prev));

      Alert.alert(
        "Success",
        "Job completed successfully!" +
          (completionData.hasInvoice ? " Invoice has been created." : "") +
          (completionData.inspectionReportId
            ? " Inspection report has been submitted."
            : ""),
        [{ text: "OK" }]
      );

      // Refresh job data
      await loadJobDetails();
    } catch (error: any) {
      console.log("[JobDetails] Error completing job:", error);
      Alert.alert("Error", error.message || "Failed to complete job");
      throw error; // Re-throw to let modal handle the error state
    }
  };

  // Check if job can be completed
  const canCompleteJob = () => {
    if (!job) return false;

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

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading job details...
        </Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>
          Job not found
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={loadJobDetails}
        >
          <Text style={[styles.retryButtonText, { color: theme.surface }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(job.status);
  const priorityColor = getPriorityColor(job.priority);

  // Check if job is due (overdue)
  const isJobDue = () => {
    const today = new Date();
    const dueDate = new Date(job.dueDate);
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return (
      dueDate < today &&
      (job.status === "Scheduled" || job.status === "In Progress")
    );
  };

  const isDue = isJobDue();
  const latestInspectionReport = job.latestInspectionReport;
  const reportUrl =
    latestInspectionReport?.pdf?.url ||
    (typeof job.reportFile === "string" && job.reportFile.trim()
      ? job.reportFile
      : undefined);
  const reportSubmittedAt = latestInspectionReport?.submittedAt;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Job ${job.job_id}`,
          headerBackTitle: "Jobs",
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.primary,
          headerTitleStyle: {
            fontWeight: "bold",
            color: theme.text,
          },
        }}
      />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Job Header Info */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.backButtonText, { color: theme.primary }]}>
              Back
            </Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <View style={styles.jobIdContainer}>
              <Text style={[styles.jobId, { color: theme.primary }]}>
                {job.job_id}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {isDue && (
                  <View
                    style={[styles.dueBadge, { backgroundColor: theme.error }]}
                  >
                    <MaterialCommunityIcons
                      name="alert"
                      size={12}
                      color="white"
                    />
                    <Text style={styles.dueText}>DUE</Text>
                  </View>
                )}
                {job.status === "Completed" ? (
                  <View
                    style={[
                      styles.completedBadge,
                      { backgroundColor: "#10B981" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="check"
                      size={12}
                      color="white"
                    />
                    <Text style={styles.completedText}>COMPLETED</Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor.bg },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusColor.text }]}
                    >
                      {job.status}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.jobTypeContainer}>
              <MaterialCommunityIcons
                name={getJobTypeIcon(job.jobType) as any}
                size={18}
                color={theme.success}
              />
              <Text style={[styles.jobType, { color: theme.success }]}>
                {job.jobType}
              </Text>
            </View>
            <Text
              style={[styles.jobDescription, { color: theme.text }]}
            >
              {getJobTitle(job)}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Countdown Timer */}
          <View style={styles.section}>
            <CountdownTimer dueDate={job.dueDate} status={job.status} />
          </View>

          {/* Job Information */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="clipboard-text"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Job Information
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: theme.textSecondary }]}
                  >
                    Due Date
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {formatDate(job.dueDate)}
                  </Text>
                </View>
              </View>

              {job.notes && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons
                    name="note-text"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.infoContent}>
                    <Text
                      style={[styles.infoLabel, { color: theme.textSecondary }]}
                    >
                      Notes
                    </Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {job.notes}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Property Details */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="home"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Property Details
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: theme.textSecondary }]}
                  >
                    Address
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {typeof job.property?.address === "string"
                      ? job.property.address
                      : job.property?.address?.fullAddress ||
                        "Address not available"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="home"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: theme.textSecondary }]}
                  >
                    Property Type
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {job.property?.propertyType ||
                      "Property type not available"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="map"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: theme.textSecondary }]}
                  >
                    Region
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {job.property?.region || "Region not available"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="account-group"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Contact Information
              </Text>
            </View>

            {/* Tenant */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                Tenant
              </Text>
              <View style={styles.contactRow}>
                <MaterialCommunityIcons
                  name="account"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: theme.text }]}>
                    {job.property?.currentTenant?.name ||
                      "Tenant not available"}
                  </Text>
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.currentTenant?.phone &&
                        handleCall(job.property.currentTenant.phone)
                      }
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.currentTenant?.phone ||
                          "Phone not available"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.currentTenant?.email &&
                        handleEmail(job.property.currentTenant.email)
                      }
                    >
                      <MaterialCommunityIcons
                        name="email"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.currentTenant?.email ||
                          "Email not available"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Agency */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                Managing Agency
              </Text>
              <View style={styles.contactRow}>
                <MaterialCommunityIcons
                  name="office-building"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: theme.text }]}>
                    {job.property?.agency?.companyName ||
                      "Agency not available"}
                  </Text>
                  <Text
                    style={[
                      styles.contactPerson,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Contact:{" "}
                    {job.property?.agency?.contactPerson ||
                      "Contact not available"}
                  </Text>
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.agency?.phone &&
                        handleCall(job.property.agency.phone)
                      }
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.agency?.phone || "Phone not available"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.agency?.email &&
                        handleEmail(job.property.agency.email)
                      }
                    >
                      <MaterialCommunityIcons
                        name="email"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.agency?.email || "Email not available"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Property Manager */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                Property Manager
              </Text>
              <View style={styles.contactRow}>
                <MaterialCommunityIcons
                  name="account-star"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: theme.text }]}>
                    {job.property?.propertyManager?.name ||
                      job.property?.agency?.contactPerson ||
                      "N/A"}
                  </Text>
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() => {
                        const phone =
                          job.property?.propertyManager?.phone ||
                          job.property?.agency?.phone;
                        phone && handleCall(phone);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.propertyManager?.phone ||
                          job.property?.agency?.phone ||
                          "Phone not available"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() => {
                        const email =
                          job.property?.propertyManager?.email ||
                          job.property?.agency?.email;
                        email && handleEmail(email);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="email"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.propertyManager?.email ||
                          job.property?.agency?.email ||
                          "Email not available"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Landlord */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                Landlord
              </Text>
              <View style={styles.contactRow}>
                <MaterialCommunityIcons
                  name="account-tie"
                  size={20}
                  color={theme.textSecondary}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: theme.text }]}>
                    {job.property?.currentLandlord?.name ||
                      "Landlord not available"}
                  </Text>
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.currentLandlord?.phone &&
                        handleCall(job.property.currentLandlord.phone)
                      }
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.currentLandlord?.phone ||
                          "Phone not available"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.contactButton,
                        {
                          backgroundColor: isDark
                            ? theme.primary + "20"
                            : "#F0F9FF",
                        },
                      ]}
                      onPress={() =>
                        job.property?.currentLandlord?.email &&
                        handleEmail(job.property.currentLandlord.email)
                      }
                    >
                      <MaterialCommunityIcons
                        name="email"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.contactButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        {job.property?.currentLandlord?.email ||
                          "Email not available"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {job.status === "Completed" && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="file-document"
                  size={24}
                  color={theme.primary}
                />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Job Report
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.reportHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                      Inspection Report
                    </Text>
                    <Text
                      style={[styles.reportMeta, { color: theme.textSecondary }]}
                    >
                      {reportSubmittedAt
                        ? `Submitted ${formatDate(reportSubmittedAt)}`
                        : "Awaiting submission"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.reportStatusBadge,
                      {
                        backgroundColor: reportUrl
                          ? (theme.success || "#10B981") + "20"
                          : (theme.warning || "#F59E0B") + "20",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={reportUrl ? "check-circle" : "clock-outline"}
                      size={16}
                      color={reportUrl ? theme.success || "#10B981" : theme.warning || "#F59E0B"}
                    />
                    <Text
                      style={[
                        styles.reportStatusText,
                        {
                          color: reportUrl
                            ? theme.success || "#10B981"
                            : theme.warning || "#F59E0B",
                        },
                      ]}
                    >
                      {reportUrl ? "AVAILABLE" : "PENDING"}
                    </Text>
                  </View>
                </View>

                {latestInspectionReport?.jobType && (
                  <Text
                    style={[styles.reportMeta, { color: theme.textSecondary }]}
                  >
                    Report Type: {latestInspectionReport.jobType}
                  </Text>
                )}

                {reportUrl ? (
                  <TouchableOpacity
                    style={[
                      styles.reportButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleOpenReport(reportUrl)}
                  >
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={20}
                      color="white"
                    />
                    <Text style={styles.reportButtonText}>View Report</Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[styles.reportEmpty, { color: theme.textSecondary }]}
                  >
                    Report is being generated. Please refresh this page in a
                    few minutes.
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {job.status === "Pending" && (
              <TouchableOpacity
                style={[
                  styles.claimButton,
                  { backgroundColor: theme.primary },
                  claimingJob && {
                    backgroundColor: theme.background,
                    opacity: 0.7,
                  },
                ]}
                onPress={handleClaimJob}
                disabled={claimingJob}
              >
                {claimingJob ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons
                    name="account-plus"
                    size={24}
                    color="white"
                  />
                )}
                <Text style={styles.claimButtonText}>
                  {claimingJob ? "Claiming..." : "Claim This Job"}
                </Text>
              </TouchableOpacity>
            )}

            {(job.status === "Scheduled" || job.status === "In Progress") &&
              canCompleteJob() && (
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    { backgroundColor: theme.success },
                  ]}
                  onPress={() => setShowCompletionModal(true)}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.completeButtonText}>Complete Job</Text>
                </TouchableOpacity>
              )}

            {(job.status === "Scheduled" || job.status === "In Progress") &&
              !canCompleteJob() && (
                <View
                  style={[
                    styles.notDueInfo,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="information"
                    size={20}
                    color={theme.info}
                  />
                  <Text
                    style={[styles.notDueText, { color: theme.textSecondary }]}
                  >
                    Job can be completed on or after the due date
                  </Text>
                </View>
              )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Job Completion Modal */}
        {job && (() => {
          // Always prioritize job.id (MongoDB ObjectId) over job_id (human-readable)
          const finalJobId = job.id || (job as any)._id || (Array.isArray(id) ? id[0] : id);
          const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(finalJobId);

          console.log("[JobDetails] Rendering modal with job object:", {
            jobKeys: Object.keys(job),
            'job.id (MongoDB ObjectId)': job.id,
            'job.job_id (human-readable)': job.job_id,
            'job._id': (job as any)._id,
            urlId: id,
            finalJobId: finalJobId,
            isValidObjectId: isValidObjectId,
            jobType: job.jobType
          });

          if (!isValidObjectId) {
            console.warn("[JobDetails] WARNING: finalJobId is not a valid MongoDB ObjectId format:", finalJobId);
          }

          return (
            <JobCompletionModal
              visible={showCompletionModal}
              onClose={() => setShowCompletionModal(false)}
              onSubmit={handleCompleteJob}
              jobId={finalJobId}
              jobType={job.jobType}
              job={{
                status: job.status,
                dueDate: job.dueDate
              }}
            />
          );
        })()}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerContent: {
    // paddingHorizontal: 16,
  },
  jobIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  jobId: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
  },
  jobTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  jobType: {
    fontSize: 16,
    color: "#10B981",
    fontWeight: "600",
    marginLeft: 8,
  },
  jobDescription: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  priorityContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  priorityCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priorityLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dueText: {
    fontSize: 11,
    fontWeight: "700",
    color: "white",
    letterSpacing: 0.5,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    backgroundColor: "#10B981",
  },
  completedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "white",
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginLeft: 8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  contactPerson: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  contactActions: {
    gap: 6,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#F0F9FF",
    borderRadius: 6,
    marginBottom: 4,
  },
  contactButtonText: {
    fontSize: 14,
    color: "#024974",
    marginLeft: 6,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 16,
  },
  reportMeta: {
    fontSize: 14,
    marginTop: 4,
  },
  reportStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  reportStatusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  reportButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  reportEmpty: {
    fontSize: 14,
    marginTop: 12,
  },
  actionSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  claimButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  notDueInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  notDueText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  countdownCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  countdownTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  countdownTimer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  timeUnit: {
    alignItems: "center",
  },
  timeValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  timeLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  countdownSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
