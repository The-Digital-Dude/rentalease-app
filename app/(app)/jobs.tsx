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
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { fetchAvailableJobs, claimJob, Job, JobFilters } from "@services/jobs";
import { useTheme } from "../../contexts/ThemeContext";
import { FilterPills } from "../../components/FilterPills";

// Helper Functions
const getPriorityColor = (priority: string, isDue = false) => {
  if (isDue) {
    return "#FEE2E2"; // Light red for due jobs
  }
  const colors = {
    Low: "#D1FAE5",
    Medium: "#FEF3C7",
    High: "#FED7AA",
    Critical: "#FEE2E2",
  };
  return colors[priority] || "#F3F4F6";
};

const isJobDue = (dueDate: string) => {
  const today = new Date();
  const due = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

const getJobTypeIcon = (jobType: string) => {
  const icons = {
    Smoke: "smoke-detector",
    Gas: "gas-cylinder",
    Electrical: "lightning-bolt",
    Plumbing: "pipe-wrench",
    HVAC: "air-conditioner",
    "Pool Safety": "pool",
    "Routine Inspection": "clipboard-check",
    Repairs: "tools",
  };
  return icons[jobType] || "briefcase";
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function JobsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]); // Store all jobs for client-side filtering
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]); // Store filtered results
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [claimingJobs, setClaimingJobs] = useState<Set<string>>(new Set());

  const loadJobs = async (isRefresh = false, filters: JobFilters = {}) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (filters.page === 1) setLoading(true);

      const data = await fetchAvailableJobs({
        ...filters,
        page: filters.page || 1,
        limit: 50, // Get more jobs for better client-side filtering
        // Remove server-side search to implement client-side search
      });

      if (filters.page === 1 || isRefresh) {
        setAllJobs(data.jobs);
        setJobs(data.jobs);
        // Apply current search and filters
        applyFiltersAndSearch(data.jobs, searchQuery, selectedFilter);
      } else {
        const newAllJobs = [...allJobs, ...data.jobs];
        setAllJobs(newAllJobs);
        setJobs(newAllJobs);
        // Apply current search and filters
        applyFiltersAndSearch(newAllJobs, searchQuery, selectedFilter);
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
      Alert.alert("Error", error.message || "Failed to load jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Apply filters when jobs are loaded
  useEffect(() => {
    if (allJobs.length > 0) {
      applyFiltersAndSearch(allJobs, searchQuery, selectedFilter);
    }
  }, [allJobs]);

  const onRefresh = () => {
    loadJobs(true, { page: 1 });
  };

  // Enhanced search function that searches across multiple fields
  const searchJobs = (jobs: Job[], query: string): Job[] => {
    if (!query.trim()) return jobs;
    
    const searchTerm = query.toLowerCase().trim();
    
    return jobs.filter(job => {
      // Search in job ID
      if (job.job_id.toLowerCase().includes(searchTerm)) return true;
      
      // Search in job type
      if (job.jobType.toLowerCase().includes(searchTerm)) return true;
      
      // Search in description
      if (job.description.toLowerCase().includes(searchTerm)) return true;
      
      // Search in property address
      if (job.property.address) {
        if (typeof job.property.address === 'string') {
          if (job.property.address.toLowerCase().includes(searchTerm)) return true;
        } else {
          const address = job.property.address;
          if (address.fullAddress?.toLowerCase().includes(searchTerm)) return true;
          if (address.street?.toLowerCase().includes(searchTerm)) return true;
          if (address.suburb?.toLowerCase().includes(searchTerm)) return true;
          if (address.state?.toLowerCase().includes(searchTerm)) return true;
          if (address.postcode?.toLowerCase().includes(searchTerm)) return true;
        }
      }
      
      // Search in property type
      if (job.property.propertyType?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in region
      if (job.property.region?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in agency name
      if (job.property.agency?.companyName?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in tenant name
      if (job.property.currentTenant?.name?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in landlord name
      if (job.property.currentLandlord?.name?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in priority
      if (job.priority.toLowerCase().includes(searchTerm)) return true;
      
      // Search in notes
      if (job.notes?.toLowerCase().includes(searchTerm)) return true;
      
      return false;
    });
  };

  // Apply filters and search to jobs
  const applyFiltersAndSearch = (jobsList: Job[], query: string, filter: string) => {
    let filtered = [...jobsList];

    // Apply search filter
    if (query.trim()) {
      filtered = searchJobs(filtered, query);
    }

    // Apply priority/status/job type filter
    if (filter !== "All") {
      switch (filter) {
        case "Due Jobs":
          filtered = filtered.filter(job => isJobDue(job.dueDate));
          break;
        case "High Priority":
          filtered = filtered.filter(job => job.priority === "High" || job.priority === "Critical");
          break;
        case "Medium Priority":
          filtered = filtered.filter(job => job.priority === "Medium");
          break;
        case "Low Priority":
          filtered = filtered.filter(job => job.priority === "Low");
          break;
        case "Smoke":
          filtered = filtered.filter(job => job.jobType === "Smoke");
          break;
        case "Gas":
          filtered = filtered.filter(job => job.jobType === "Gas");
          break;
        case "Electrical":
          filtered = filtered.filter(job => job.jobType === "Electrical");
          break;
        default:
          break;
      }
    }

    setFilteredJobs(filtered);
  };

  // Handle search input changes (real-time search)
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFiltersAndSearch(allJobs, text, selectedFilter);
  };

  // Handle filter changes
  const handleFilterChange = (filterId: string) => {
    setSelectedFilter(filterId);
    applyFiltersAndSearch(allJobs, searchQuery, filterId);
  };

  const onSearch = () => {
    applyFiltersAndSearch(allJobs, searchQuery, selectedFilter);
  };

  const onLoadMore = () => {
    if (pagination.hasNextPage && !loadingMore) {
      setLoadingMore(true);
      loadJobs(false, { page: pagination.currentPage + 1 }).finally(() => {
        setLoadingMore(false);
      });
    }
  };

  const handleClaimJob = async (jobId: string) => {
    if (claimingJobs.has(jobId)) return;

    Alert.alert("Claim Job", "Are you sure you want to claim this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Claim",
        onPress: async () => {
          try {
            setClaimingJobs((prev) => new Set(prev).add(jobId));
            console.log("[JobsPage] Claiming job:", jobId);
            await claimJob(jobId);
            console.log("[JobsPage] Job claimed successfully");
            Alert.alert("Success", "Job claimed successfully!");
            onRefresh();
          } catch (error: any) {
            console.log("[JobsPage] Error claiming job:", error);
            Alert.alert("Error", error.message || "Failed to claim job");
          } finally {
            setClaimingJobs((prev) => {
              const newSet = new Set(prev);
              newSet.delete(jobId);
              return newSet;
            });
          }
        },
      },
    ]);
  };

  const applyFilter = (pill: { id: string; label: string }) => {
    setSelectedFilter(pill.id);
    setShowFilterModal(false);
    
    // For due jobs, we'll filter client-side since the backend might not support it
    if (pill.id === "Due Jobs") {
      loadJobs(false, { page: 1 });
      return;
    }
    
    const filterMap: Record<string, JobFilters> = {
      All: {},
      "High Priority": { priority: "High" },
      "Medium Priority": { priority: "Medium" },
      Smoke: { jobType: "Smoke" },
      Gas: { jobType: "Gas" },
      Electrical: { jobType: "Electrical" },
    };
    loadJobs(false, { ...filterMap[pill.id], page: 1 });
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

  const renderJobCard = ({ item }: { item: Job }) => {
    const isDue = isJobDue(item.dueDate);

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
        isDue && styles.dueJobCard,
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
                  : (isDark ? theme.primary + "20" : "#F0F9FF")
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isDue && (
              <View
                style={[
                  styles.dueBadge,
                  { backgroundColor: theme.error }
                ]}
              >
                <MaterialCommunityIcons
                  name="alert"
                  size={12}
                  color="white"
                />
                <Text style={styles.dueText}>DUE</Text>
              </View>
            )}
            {item.status === "Completed" && (
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
            )}
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(item.priority, isDue) },
              ]}
            >
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.jobTitle, { color: theme.text }]}>
          {getJobTitle(item)}
        </Text>
        <View style={styles.jobTypeContainer}>
          <MaterialCommunityIcons
            name={getJobTypeIcon(item.jobType)}
            size={16}
            color={item.status === "Completed" ? "#10B981" : theme.primary}
          />
          <Text style={[styles.jobType, { 
            color: item.status === "Completed" ? "#10B981" : theme.primary 
          }]}>
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
            Property Manager: {item.property?.propertyManager?.name || item.property?.agency?.contactPerson || "N/A"}
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
            styles.claimButton,
            { 
              backgroundColor: item.status === "Completed" ? "#10B981" : theme.primary 
            },
            claimingJobs.has(item.id) && {
              backgroundColor: theme.background,
              opacity: 0.7,
            },
          ]}
          onPress={() => handleClaimJob(item.id)}
          disabled={claimingJobs.has(item.id)}
        >
          {claimingJobs.has(item.id) ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialCommunityIcons
              name="account-plus"
              size={20}
              color="white"
            />
          )}
          <Text style={styles.claimButtonText}>
            {claimingJobs.has(item.id) ? "Claiming..." : "Claim Job"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            { 
              backgroundColor: theme.surface, 
              borderColor: item.status === "Completed" ? "#10B981" : theme.primary 
            },
          ]}
          onPress={() => router.push(`/job-details/${item.id}`)}
        >
          <MaterialCommunityIcons 
            name="eye" 
            size={20} 
            color={item.status === "Completed" ? "#10B981" : theme.primary} 
          />
          <Text style={[styles.viewButtonText, { 
            color: item.status === "Completed" ? "#10B981" : theme.primary 
          }]}>
            View Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateWrapper}>
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="briefcase-search"
          size={64}
          color={theme.textTertiary}
        />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No Available Jobs
        </Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {searchQuery
            ? "Try adjusting your search or filters"
            : "Check back later for new opportunities"}
        </Text>
      </View>
    </View>
  );

  const filterOptions = [
    { id: "All", label: "All Jobs" },
    { id: "Due Jobs", label: "Due Jobs" },
    { id: "High Priority", label: "High Priority" },
    { id: "Medium Priority", label: "Medium Priority" },
    { id: "Smoke", label: "Smoke" },
    { id: "Gas", label: "Gas" },
    { id: "Electrical", label: "Electrical" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          Available Jobs
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {(searchQuery.trim() || selectedFilter !== "All" ? filteredJobs : jobs).length} jobs available
        </Text>
      </View>

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
            placeholder="Search jobs..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.surface }]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialCommunityIcons
            name="filter"
            size={20}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <FilterPills
        pills={filterOptions}
        selectedPill={selectedFilter}
        onPillPress={handleFilterChange}
        theme={theme}
        isDark={isDark}
        style={{ marginBottom: 8 }}
      />

      {/* Jobs List */}
      {loading && jobs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading jobs...
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchQuery.trim() || selectedFilter !== "All" ? filteredJobs : jobs}
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
            (searchQuery.trim() || selectedFilter !== "All" ? filteredJobs : jobs).length === 0 && styles.emptyListContainer,
            (searchQuery.trim() || selectedFilter !== "All" ? filteredJobs : jobs).length > 0 && [
              styles.listContainer,
              { paddingBottom: 110 },
            ],
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

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setShowFilterModal(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Filter Jobs
            </Text>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.filterOption,
                  selectedFilter === option.id && {
                    backgroundColor: isDark ? theme.primary + "20" : "#F0F9FF",
                  },
                ]}
                onPress={() => applyFilter(option)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    { color: theme.text },
                    selectedFilter === option.id && {
                      color: theme.primary,
                      fontWeight: "500",
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selectedFilter === option.id && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={theme.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#012D4F",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
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
    color: "#1F2937",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 48,
    justifyContent: "center",
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#024974",
    fontWeight: "500",
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
    color: "#6B7280",
  },
  listContainer: {
    paddingTop: 4,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: "#6B7280",
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#024974",
    borderStyle: "dashed",
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 16,
    color: "#024974",
    fontWeight: "600",
    marginRight: 8,
  },
  endOfList: {
    alignItems: "center",
    paddingVertical: 24,
  },
  endOfListText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  jobCard: {
    backgroundColor: "white",
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
    borderLeftColor: "#024974",
  },
  dueJobCard: {
    shadowColor: "#EF4444",
    shadowOpacity: 0.15,
    elevation: 6,
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EF4444",
  },
  dueText: {
    fontSize: 11,
    fontWeight: "700",
    color: "white",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#10B981",
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
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  jobId: {
    fontSize: 13,
    fontWeight: "600",
    color: "#024974",
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
    color: "#1F2937",
    marginBottom: 4,
  },
  jobType: {
    fontSize: 14,
    color: "#024974",
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
    color: "#6B7280",
    flex: 1,
  },
  jobDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  notesContainer: {
    marginBottom: 12,
  },
  notesText: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    lineHeight: 16,
  },
  jobActions: {
    flexDirection: "row",
    gap: 8,
  },
  claimButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#024974",
    paddingVertical: 12,
    borderRadius: 8,
  },
  claimButtonText: {
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
    borderColor: "#024974",
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewButtonText: {
    color: "#024974",
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
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
    maxWidth: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedFilterOption: {
    backgroundColor: "#F0F9FF",
  },
  filterOptionText: {
    fontSize: 16,
    color: "#1F2937",
  },
  selectedFilterOptionText: {
    color: "#024974",
    fontWeight: "500",
  },
});
