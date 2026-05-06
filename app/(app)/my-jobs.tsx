import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchTechnicianJobs, completeJob, Job } from "@services/jobs";
import { useRouter } from "expo-router";
import { useTheme, Theme } from "../../contexts/ThemeContext";
import { FilterPills } from "../../components/FilterPills";
import { JobCompletionModal, JobCompletionData } from "../../components/JobCompletionModal";

export default function ActiveJobsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [error, setError] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [selectedJobForCompletion, setSelectedJobForCompletion] = useState<Job | null>(null);

  const loadJobs = useCallback(
    async (isRefresh = false, status = "All") => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const filters = status === "All" ? {} : { status };
        const data = await fetchTechnicianJobs({
          ...filters,
          page: 1,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "desc",
        });

        // Show newly assigned or recently updated jobs first.
        const sortedJobs = (data.jobs || []).sort((a, b) => {
          const recentA = new Date(a.updatedAt || a.createdAt).getTime();
          const recentB = new Date(b.updatedAt || b.createdAt).getTime();

          if (recentA !== recentB) {
            return recentB - recentA;
          }

          const dueA = new Date(a.dueDate).getTime();
          const dueB = new Date(b.dueDate).getTime();
          return dueA - dueB;
        });

        setJobs(sortedJobs);
      } catch (error: any) {
        console.log("[MyJobs] Error loading jobs:", error);
        setError(error.message || "Failed to load jobs");

        // Handle authentication errors specifically
        if (error.message?.includes("Authentication expired")) {
          Alert.alert("Session Expired", "Please login again to continue.", [
            { text: "OK", onPress: () => router.replace("/(auth)/login") },
          ]);
        } else {
          Alert.alert("Error", error.message || "Failed to load jobs");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadJobs(false, selectedStatus);
  }, [loadJobs, selectedStatus]);

  const onRefresh = useCallback(() => {
    loadJobs(true, selectedStatus);
  }, [loadJobs, selectedStatus]);

  const changeStatus = useCallback((pillId: string) => {
    setSelectedStatus(pillId);
  }, []);

  // Handle job completion
  const handleCompleteJob = async (completionData: JobCompletionData) => {
    if (!selectedJobForCompletion) return;

    try {
      // Always use the MongoDB ObjectId, not the human-readable job_id
      const jobId = selectedJobForCompletion.id || (selectedJobForCompletion as any)._id;
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(jobId);

      console.log("[MyJobs] Completing job with ID analysis:", {
        'job.id (MongoDB ObjectId)': selectedJobForCompletion.id,
        'job.job_id (human-readable)': selectedJobForCompletion.job_id,
        'job._id': (selectedJobForCompletion as any)._id,
        finalJobId: jobId,
        isValidObjectId: isValidObjectId,
        completionData: completionData
      });

      if (!isValidObjectId) {
        console.error("[MyJobs] ERROR: Invalid MongoDB ObjectId format:", jobId);
        Alert.alert("Error", "Invalid job ID format. Please try again or contact support.");
        return;
      }

      const result = await completeJob(jobId, completionData);
      console.log("[MyJobs] Job completed successfully:", result);
      
      // Update local jobs state using the same ID logic
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobId
            ? { ...job, status: "Completed" }
            : job
        )
      );
      
      Alert.alert(
        "Success", 
        "Job completed successfully!" + 
        (completionData.hasInvoice ? " Invoice has been created." : "") +
        (completionData.inspectionReportId ? " Report has been uploaded." : ""),
        [{ text: "OK" }]
      );
      
      // Close modal and reset selected job
      setShowCompletionModal(false);
      setSelectedJobForCompletion(null);
      
      // Refresh jobs list
      loadJobs(false, selectedStatus);
    } catch (error: any) {
      console.log("[MyJobs] Error completing job:", error);
      Alert.alert("Error", error.message || "Failed to complete job");
      throw error; // Re-throw to let modal handle the error state
    }
  };

  // Open completion modal for a specific job
  const openCompletionModal = (job: Job) => {
    setSelectedJobForCompletion(job);
    setShowCompletionModal(true);
  };

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; bgColor: string; icon: string }> = {
      Scheduled: {
        color: "#3B82F6",
        bgColor: "#DBEAFE",
        icon: "calendar-clock",
      },
      Pending: { color: "#F59E0B", bgColor: "#FEF3C7", icon: "clock-outline" },
      "In Progress": {
        color: "#10B981",
        bgColor: "#D1FAE5",
        icon: "play-circle",
      },
      Completed: { color: "#10B981", bgColor: isDark ? "#064E3B" : "#D1FAE5", icon: "check-circle" },
      Cancelled: { color: "#EF4444", bgColor: "#FEE2E2", icon: "close-circle" },
    };
    return (
      statusConfig[status] || {
        color: "#6B7280",
        bgColor: "#F3F4F6",
        icon: "help-circle",
      }
    );
  };

  const renderJobCard = useCallback(
    ({ item }: { item: Job }) => {
      const statusInfo = getStatusInfo(item.status);

      const getJobTitle = () => {
        // If title exists, use it
        if (item.title) return item.title;

        // Get location info
        let location = "";
        if (item.property?.address) {
          if (typeof item.property.address === "string") {
            // Extract suburb or first part of address
            const parts = item.property.address.split(",");
            location = parts.length > 1 ? parts[1].trim() : parts[0].trim();
          } else {
            // Use suburb or street
            location = item.property.address.suburb || item.property.address.street || "";
          }
        }

        // Get property type for context
        const propertyType = item.property?.propertyType || "";

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

        const baseTitle = jobTypeTitles[item.jobType] || `${item.jobType} Service`;

        // Add location or property type to make it more specific
        if (location) {
          return `${baseTitle} - ${location}`;
        } else if (propertyType) {
          return `${baseTitle} (${propertyType})`;
        }

        return baseTitle;
      };

      const getPropertyAddress = () => {
        if (typeof item.property?.address === "string") {
          return item.property.address;
        }
        return item.property?.address?.fullAddress || "Address not available";
      };

      const getTenantName = () => {
        return item.property?.currentTenant?.name || "Tenant not available";
      };

      const getTenantPhone = () => {
        return item.property?.currentTenant?.phone;
      };

      const handleJobPress = () => {
        router.push(`/job-details/${item.id}`);
      };

      const handlePhonePress = () => {
        const phone = getTenantPhone();
        if (phone) {
          // Handle phone call
          console.log("Calling:", phone);
        }
      };

      // Check if job can be completed (due date is today or past)
      const canCompleteJob = () => {
        const today = new Date();
        const dueDate = new Date(item.dueDate);
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate <= today;
      };

      // Check if job is due (overdue)
      const isJobDue = () => {
        const today = new Date();
        const dueDate = new Date(item.dueDate);
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        return (
          dueDate < today &&
          (item.status === "Scheduled" || item.status === "In Progress")
        );
      };

      const isDue = isJobDue();

      return (
        <View
          style={[
            styles.jobCard,
            {
              backgroundColor: theme.card,
              borderLeftColor: isDue ? theme.error : (item.status === "Completed" ? "#10B981" : theme.primary),
              borderWidth: isDue ? 2 : 0,
              borderColor: isDue ? theme.error : "transparent",
            },
          ]}
        >
          <View style={styles.jobHeader}>
            <View style={styles.jobTitleRow}>
              <View
                style={[
                  styles.jobIdContainer,
                  {
                    backgroundColor: item.status === "Completed" 
                      ? "#10B981"
                      : (isDark ? theme.primary + "20" : "#F0F9FF"),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="briefcase-outline"
                  size={16}
                  color={item.status === "Completed" ? "white" : theme.primary}
                />
                <Text style={[styles.jobId, { 
                  color: item.status === "Completed" ? "white" : theme.primary 
                }]}>
                  {item.job_id}
                </Text>
              </View>
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
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: statusInfo.bgColor },
                  ]}
                >
                  <Text
                    style={[styles.priorityText, { color: statusInfo.color }]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.jobTitle, { color: theme.text }]}>
              {getJobTitle()}
            </Text>
            <View style={styles.jobTypeContainer}>
              <MaterialCommunityIcons
                name="wrench"
                size={16}
                color={theme.success}
              />
              <Text style={[styles.jobType, { color: theme.success }]}>
                {item.jobType}
              </Text>
            </View>
          </View>

          <View style={styles.jobDetails}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {getPropertyAddress()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Due: {formatDate(item.dueDate)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {getTenantName()}
              </Text>
              {getTenantPhone() && (
                <TouchableOpacity
                  style={[
                    styles.phoneButton,
                    { backgroundColor: theme.background },
                  ]}
                  onPress={handlePhonePress}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={16}
                    color={item.status === "Completed" ? "#10B981" : theme.primary}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account-star"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Property Manager: {item.property?.propertyManager?.name || item.property?.agency?.contactPerson || "N/A"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Technician: {item.assignedTechnician
                  ? `${item.assignedTechnician.firstName || ''} ${item.assignedTechnician.lastName || ''}`.trim()
                  : 'Not Assigned'
                }
              </Text>
            </View>
          </View>

          {item.description && (
            <Text
              style={[styles.jobDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}

          <View style={styles.jobActions}>
            {(item.status === "Scheduled" || item.status === "In Progress") &&
              canCompleteJob() && (
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    { backgroundColor: theme.success },
                  ]}
                  onPress={() => openCompletionModal(item)}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="white"
                  />
                  <Text style={styles.completeButtonText}>Complete Job</Text>
                </TouchableOpacity>
              )}

            <TouchableOpacity
              style={[
                styles.viewButton,
                { backgroundColor: theme.surface, borderColor: item.status === "Completed" ? "#10B981" : theme.primary },
              ]}
              onPress={handleJobPress}
            >
              <MaterialCommunityIcons
                name="eye"
                size={20}
                color={item.status === "Completed" ? "#10B981" : theme.primary}
              />
              <Text style={[styles.viewButtonText, { color: item.status === "Completed" ? "#10B981" : theme.primary }]}>
                View Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [router, theme, isDark]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyStateWrapper}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="clipboard-list"
            size={64}
            color={theme.textTertiary}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No {selectedStatus === "All" ? "" : selectedStatus} Jobs
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {selectedStatus === "All"
              ? "You don't have any jobs at the moment"
              : selectedStatus === "Active"
              ? "You don't have any active jobs at the moment"
              : `No ${selectedStatus.toLowerCase()} jobs found`}
          </Text>
        </View>
      </View>
    ),
    [selectedStatus, theme]
  );

  const renderErrorState = useCallback(
    () => (
      <View style={styles.emptyStateWrapper}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.emptyTitle}>Error Loading Jobs</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadJobs(false, selectedStatus)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [error, loadJobs, selectedStatus]
  );

  const statusOptions = [
    { id: "All", label: "All Jobs" },
    { id: "Active", label: "Active" },
    { id: "Scheduled", label: "Scheduled" },
    { id: "In Progress", label: "In Progress" },
    { id: "Completed", label: "Completed" },
  ];
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <Text style={styles.subtitle}>
          {jobs.length} {selectedStatus.toLowerCase()} jobs
        </Text>
      </View>

      {/* Status Filter Pills */}
      <FilterPills
        pills={statusOptions}
        selectedPill={selectedStatus}
        onPillPress={changeStatus}
        theme={theme}
        isDark={isDark}
        style={{ marginTop: 4, marginBottom: 8 }}
      />

      {/* Jobs List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor="white"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            jobs.length === 0 && styles.emptyListContainer,
            jobs.length > 0 && [
              styles.listContainer,
              { paddingBottom: 100 },
            ],
          ]}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={10}
        />
      )}

      {/* Job Completion Modal */}
      {selectedJobForCompletion && (() => {
        // Always use the MongoDB ObjectId (selectedJobForCompletion.id), not the human-readable job_id
        const jobId = selectedJobForCompletion.id || (selectedJobForCompletion as any)._id;
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(jobId);

        console.log("[MyJobs] Modal rendering with job:", {
          'job.id (MongoDB ObjectId)': selectedJobForCompletion.id,
          'job.job_id (human-readable)': selectedJobForCompletion.job_id,
          'job._id': (selectedJobForCompletion as any)._id,
          finalJobId: jobId,
          isValidObjectId: isValidObjectId,
          jobType: selectedJobForCompletion.jobType
        });

        if (!isValidObjectId) {
          console.error("[MyJobs] ERROR: Invalid MongoDB ObjectId format:", jobId);
        }

        return (
            <JobCompletionModal
              visible={showCompletionModal}
              onClose={() => {
                setShowCompletionModal(false);
                setSelectedJobForCompletion(null);
                loadJobs(false, selectedStatus);
              }}
              onSubmit={handleCompleteJob}
              jobId={jobId}
            jobType={selectedJobForCompletion.jobType}
            job={{
              status: selectedJobForCompletion.status,
              dueDate: selectedJobForCompletion.dueDate
            }}
          />
        );
      })()}
    </View>
  );
}

// Helper Functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours =
    Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    listContainer: {
      paddingTop: 4,
    },
    emptyListContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    jobCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
    },
    jobHeader: {
      marginBottom: 12,
    },
    jobTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    jobIdContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F0F9FF",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    jobId: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primary,
      marginLeft: 6,
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    priorityText: {
      fontSize: 12,
      fontWeight: "500",
      color: "#1F2937",
    },
    jobTypeContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },
    jobTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
    },
    jobType: {
      fontSize: 14,
      color: theme.success,
      fontWeight: "600",
      marginLeft: 6,
    },
    jobDetails: {
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    detailText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
    },
    estimatedHours: {
      fontSize: 12,
      color: theme.textTertiary,
      marginLeft: 4,
    },
    phoneButton: {
      padding: 4,
      borderRadius: 4,
      backgroundColor: theme.background,
    },
    jobDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    jobActions: {
      flexDirection: "row",
      gap: 8,
    },
    completeButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
    },
    completeButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 6,
    },
    viewButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
    },
    viewButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 6,
    },
    emptyStateWrapper: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 400,
    },
    emptyState: {
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: "center",
      paddingHorizontal: 32,
      marginBottom: 16,
      lineHeight: 22,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: theme.surface,
      fontSize: 16,
      fontWeight: "600",
    },
    dueBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.error,
    },
    dueText: {
      fontSize: 11,
      fontWeight: "700",
      color: "white",
      marginLeft: 4,
      letterSpacing: 0.5,
    },
  });
