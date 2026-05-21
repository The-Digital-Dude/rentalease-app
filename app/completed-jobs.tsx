import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import {
  fetchTechnicianJobs,
  Job,
  JobFilters,
  getPropertyManagerName,
} from "@services/jobs";
import { useTheme } from "../contexts/ThemeContext";

// Helper Functions
const getPriorityColor = (priority: string) => {
  const colors = {
    Low: "#D1FAE5",
    Medium: "#FEF3C7",
    High: "#FED7AA",
    Critical: "#FEE2E2",
  };
  return colors[priority] || "#F3F4F6";
};

const getJobTypeIcon = (jobType: string) => {
  const icons = {
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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CompletedJobsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadCompletedJobs = async (isRefresh = false, filters: JobFilters = {}) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (filters.page === 1) setLoading(true);

      const data = await fetchTechnicianJobs({
        ...filters,
        status: "Completed",
        page: filters.page || 1,
        limit: 15,
        search: searchQuery || undefined,
        sortBy: "dueDate",
        sortOrder: "desc",
      });

      if (filters.page === 1 || isRefresh) {
        setJobs(data.jobs);
      } else {
        setJobs((prev) => [...prev, ...data.jobs]);
      }

      setPagination({
        currentPage: data.pagination.page,
        totalPages: data.pagination.totalPages,
        totalItems: data.pagination.total,
        itemsPerPage: data.pagination.limit,
        hasNextPage: data.pagination.page < data.pagination.totalPages,
        hasPrevPage: data.pagination.page > 1,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load completed jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCompletedJobs();
  }, []);

  const onRefresh = () => {
    loadCompletedJobs(true, { page: 1 });
  };

  const onSearch = () => {
    loadCompletedJobs(false, { page: 1 });
  };

  const onLoadMore = () => {
    if (pagination.hasNextPage && !loadingMore) {
      setLoadingMore(true);
      loadCompletedJobs(false, { page: pagination.currentPage + 1 }).finally(() => {
        setLoadingMore(false);
      });
    }
  };

  const renderJobCard = ({ item }: { item: Job }) => {
    return (
      <View
        style={[
          styles.jobCard,
          { 
            backgroundColor: theme.card, 
            borderLeftColor: theme.success,
          },
        ]}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobTitleRow}>
            <View
              style={[
                styles.jobIdContainer,
                { backgroundColor: isDark ? theme.success + "20" : "#F0FDF4" },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={theme.success}
              />
              <Text style={[styles.jobId, { color: theme.success }]}>
                {item.job_id}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={[
                  styles.completedBadge,
                  { backgroundColor: theme.success }
                ]}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={12}
                  color="white"
                />
                <Text style={styles.completedText}>COMPLETED</Text>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(item.priority) },
                ]}
              >
                <Text style={styles.priorityText}>{item.priority}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.jobTitle, { color: theme.text }]}>
            {item.title || item.description}
          </Text>
          <View style={styles.jobTypeContainer}>
            <MaterialCommunityIcons
              name={getJobTypeIcon(item.jobType)}
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
              {typeof item.property?.address === "string"
                ? item.property.address
                : item.property?.address?.fullAddress || "Address not available"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              Completed: {formatDate(item.dueDate)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="account"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              {item.property?.currentTenant?.name || "Tenant not available"}
            </Text>
          </View>

          <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account-star"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Property Manager: {getPropertyManagerName(item.property)}
              </Text>
            </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="office-building"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              {item.property?.currentLandlord?.name || "Landlord not available"}
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

        {item.notes && (
          <View style={styles.notesContainer}>
            <Text
              style={[styles.notesText, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {item.notes}
            </Text>
          </View>
        )}

        <View style={styles.jobActions}>
          <TouchableOpacity
            style={[
              styles.viewButton,
              { backgroundColor: theme.surface, borderColor: theme.primary },
            ]}
            onPress={() => router.push(`/job-details/${item.id}`)}
          >
            <MaterialCommunityIcons name="eye" size={20} color={theme.primary} />
            <Text style={[styles.viewButtonText, { color: theme.primary }]}>
              View Details
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="clipboard-check"
        size={64}
        color={theme.textTertiary}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Completed Jobs
      </Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery
          ? "No completed jobs match your search"
          : "Complete some jobs to see them here"}
      </Text>
    </View>
  );

  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "Job History",
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={theme.primary}
              />
            </TouchableOpacity>
          ),
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


      {/* Search */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputContainer,
            { backgroundColor: theme.surface },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search completed jobs..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Jobs List */}
      {loading && jobs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading completed jobs...
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item, index) => `${item.id}-${item.job_id}-${index}`}
          renderItem={renderJobCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
              titleColor={theme.text}
              progressBackgroundColor={theme.surface}
            />
          }
          ListEmptyComponent={renderEmptyState}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 110 },
            jobs.length === 0 && { flex: 1 },
          ]}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text
                  style={[
                    styles.loadingMoreText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Loading more jobs...
                </Text>
              </View>
            ) : pagination.hasNextPage ? (
              <TouchableOpacity
                style={[
                  styles.loadMoreButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.primary,
                  },
                ]}
                onPress={onLoadMore}
              >
                <Text style={[styles.loadMoreText, { color: theme.primary }]}>
                  Load More Jobs
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
            ) : jobs.length > 0 ? (
              <View style={styles.endOfList}>
                <Text
                  style={[styles.endOfListText, { color: theme.textTertiary }]}
                >
                  You've reached the end
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.text,
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
    paddingTop: 8,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.textSecondary,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.primary,
    borderStyle: "dashed",
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: "600",
    marginRight: 8,
  },
  endOfList: {
    alignItems: "center",
    paddingVertical: 24,
  },
  endOfListText: {
    fontSize: 14,
    color: theme.textTertiary,
    fontStyle: "italic",
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
    borderLeftColor: theme.success,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.success,
  },
  completedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "white",
    marginLeft: 4,
    letterSpacing: 0.5,
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
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  jobId: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.success,
    marginLeft: 6,
  },
  jobTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
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
  jobDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  notesContainer: {
    marginBottom: 12,
  },
  notesText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: "italic",
    lineHeight: 16,
  },
  jobActions: {
    flexDirection: "row",
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
