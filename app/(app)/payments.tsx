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
import { fetchTechnicianPayments, TechnicianPayment, PaymentFilters } from "@services/payments";
import { useRouter } from "expo-router";
import { useTheme, Theme } from "../../contexts/ThemeContext";
import { TECHNICIAN_PAYMENTS_ENABLED } from "../../config/features";

export default function MyPaymentsPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [payments, setPayments] = useState<TechnicianPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalPaid: 0,
    pendingAmount: 0,
    paidAmount: 0,
  });

  const loadPayments = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const data = await fetchTechnicianPayments({
          page: 1,
          limit: 50,
        });

        setPayments(data.payments || []);
        setSummary(data.summary || {
          totalPending: 0,
          totalPaid: 0,
          pendingAmount: 0,
          paidAmount: 0,
        });
      } catch (error: any) {
        console.log("[MyPayments] Error loading payments:", error);
        setError(error.message || "Failed to load payments");

        // Handle authentication errors specifically
        if (error.message?.includes("Authentication expired")) {
          Alert.alert("Session Expired", "Please login again to continue.", [
            { text: "OK", onPress: () => router.replace("/(auth)/login") },
          ]);
        } else {
          Alert.alert("Error", error.message || "Failed to load payments");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadPayments(false);
  }, [loadPayments]);

  const onRefresh = useCallback(() => {
    loadPayments(true);
  }, [loadPayments]);

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; bgColor: string; icon: string }> = {
      Pending: { color: "#F59E0B", bgColor: "#FEF3C7", icon: "clock-outline" },
      Paid: { color: "#10B981", bgColor: "#D1FAE5", icon: "check-circle" },
      Processing: { color: "#3B82F6", bgColor: "#DBEAFE", icon: "sync" },
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getPropertyAddress = (payment: TechnicianPayment) => {
    // For now, return the job description which contains address info
    return payment.jobId?.description || "Address not available";
  };

  const renderPaymentCard = useCallback(
    ({ item }: { item: TechnicianPayment }) => {
      const statusInfo = getStatusInfo(item.status);

      return (
        <View
          style={[
            styles.paymentCard,
            {
              backgroundColor: theme.card,
              borderLeftColor: statusInfo.color,
            },
          ]}
        >
          <View style={styles.paymentHeader}>
            <View style={styles.paymentTitleRow}>
              <View
                style={[
                  styles.paymentNumberContainer,
                  {
                    backgroundColor: isDark ? theme.primary + "20" : "#F0F9FF",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="receipt"
                  size={16}
                  color={theme.primary}
                />
                <Text style={[styles.paymentNumber, { color: theme.primary }]}>
                  {item.paymentNumber}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusInfo.bgColor },
                ]}
              >
                <MaterialCommunityIcons
                  name={statusInfo.icon as any}
                  size={12}
                  color={statusInfo.color}
                />
                <Text
                  style={[styles.statusText, { color: statusInfo.color }]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.paymentAmount, { color: theme.text }]}>
              {formatCurrency(item.amount)}
            </Text>
          </View>

          <View style={styles.paymentDetails}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="briefcase-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.jobId?.job_id} - {item.jobType}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={2}>
                {getPropertyAddress(item)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Completed: {formatDate(item.jobCompletedAt)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Due Date: {formatDate(item.jobId?.dueDate)}
              </Text>
            </View>

            {item.paidAt && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="calendar-check"
                  size={16}
                  color={theme.success}
                />
                <Text style={[styles.detailText, { color: theme.success }]}>
                  Paid: {formatDate(item.paidAt)}
                </Text>
              </View>
            )}
          </View>

          {item.notes && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesText, { color: theme.textSecondary }]}>
                Notes: {item.notes}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [theme, isDark]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="receipt"
          size={64}
          color={theme.textTertiary}
        />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No Payments
        </Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          You don't have any payments yet
        </Text>
      </View>
    ),
    [theme]
  );

  const renderErrorState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.emptyTitle}>Error Loading Payments</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadPayments(false)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    ),
    [error, loadPayments]
  );

  const styles = createStyles(theme);

  if (!TECHNICIAN_PAYMENTS_ENABLED) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="wallet-outline"
          size={64}
          color={theme.textTertiary}
        />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Payments Unavailable
        </Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Technician payments are currently disabled.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Payments</Text>
        <Text style={styles.subtitle}>
          {payments.length} payments
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={24}
              color={theme.warning}
            />
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              Pending
            </Text>
          </View>
          <Text style={[styles.summaryAmount, { color: isDark ? "#FCD34D" : theme.warning }]}>
            {formatCurrency(summary.pendingAmount)}
          </Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {summary.totalPending} payments
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={theme.success}
            />
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              Paid
            </Text>
          </View>
          <Text style={[styles.summaryAmount, { color: isDark ? "#6EE7B7" : theme.success }]}>
            {formatCurrency(summary.paidAmount)}
          </Text>
          <Text style={[styles.summaryCount, { color: theme.textSecondary }]}>
            {summary.totalPaid} payments
          </Text>
        </View>
      </View>

      {/* Payments List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={renderPaymentCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 100 },
            payments.length === 0 && { flex: 1 },
          ]}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={5}
          windowSize={10}
        />
      )}
    </View>
  );
}

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
    summarySection: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      gap: 12,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    summaryTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
      marginLeft: 8,
    },
    summaryAmount: {
      fontSize: 22,
      fontWeight: "bold",
      marginTop: 4,
      marginBottom: 2,
    },
    summaryCount: {
      fontSize: 11,
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
    paymentCard: {
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
    },
    paymentHeader: {
      marginBottom: 12,
    },
    paymentTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    paymentNumberContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F0F9FF",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    paymentNumber: {
      fontSize: 13,
      fontWeight: "600",
      marginLeft: 6,
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
    paymentAmount: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
    },
    paymentDetails: {
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
    notesSection: {
      backgroundColor: theme.background,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    notesText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontStyle: "italic",
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
      marginBottom: 16,
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
  });
