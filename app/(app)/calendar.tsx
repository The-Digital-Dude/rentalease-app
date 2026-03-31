import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import calendarApiService, { CalendarEvent } from '../../services/calendarApi';
import calendarDeviceService from '../../services/calendarDevice';

interface MarkedDate {
  marked: boolean;
  dotColor: string;
  selectedColor?: string;
  selected?: boolean;
}

export default function CalendarScreen() {
  const { theme } = useTheme();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, MarkedDate>>({});
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = createStyles(theme);

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // Next 3 months

      const calendarEvents = await calendarApiService.getTechnicianCalendar(
        startDate.toISOString(),
        endDate.toISOString()
      );

      setEvents(calendarEvents);
      generateMarkedDates(calendarEvents);
    } catch (error: any) {
      console.error('[CalendarScreen] Error loading calendar data:', error);
      
      // Set error state for display
      setError(error.message || 'Failed to load calendar events');
      
      // Initialize with empty data
      setEvents([]);
      setMarkedDates({});
      
      // Don't show alert automatically - let user interact with error state
    } finally {
      setLoading(false);
    }
  };

  const generateMarkedDates = (events: CalendarEvent[]) => {
    const marked: Record<string, MarkedDate> = {};
    
    events.forEach(event => {
      const date = new Date(event.startTime).toISOString().split('T')[0];
      marked[date] = {
        marked: true,
        dotColor: calendarApiService.getStatusColor(event.status),
      };
    });
    
    setMarkedDates(marked);
  };

  const getEventsForDate = (date: string): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      return eventDate === date;
    });
  };

  const syncToPhoneCalendar = async () => {
    try {
      const upcomingEvents = events.filter(event => 
        new Date(event.startTime) > new Date()
      );

      if (upcomingEvents.length === 0) {
        Alert.alert(
          'No Upcoming Events',
          'You don\'t have any upcoming scheduled jobs to sync.',
          [{ text: 'OK' }]
        );
        return;
      }

      const confirmed = await calendarDeviceService.showSyncConfirmation(upcomingEvents.length);
      if (!confirmed) return;

      setSyncing(true);
      
      const success = await calendarDeviceService.syncJobsToCalendar(upcomingEvents);
      
      if (success) {
        Alert.alert(
          'Sync Complete!',
          `Successfully synced ${upcomingEvents.length} events to your device calendar. You can now view your work schedule in your calendar app with reminders.`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          'Some events could not be synced to your calendar. Please check your calendar permissions and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[CalendarScreen] Error syncing to device calendar:', error);
      Alert.alert(
        'Sync Error',
        'Failed to sync events to your device calendar. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSyncing(false);
    }
  };

  const shareCalendarFeed = async () => {
    try {
      const feedData = await calendarApiService.getCalendarFeedUrl();
      
      Alert.alert(
        'Calendar Feed',
        'Share this calendar feed URL to subscribe to your work schedule in any calendar app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share URL',
            onPress: async () => {
              try {
                await Share.share({
                  message: `Subscribe to my RentalEase work schedule:\n\n${feedData.feedUrl}`,
                  title: 'RentalEase Calendar Feed',
                });
              } catch (error) {
                console.error('Error sharing calendar feed:', error);
              }
            }
          },
          {
            text: 'Instructions',
            onPress: () => {
              Alert.alert(
                'Setup Instructions',
                `iOS: ${feedData.instructions.ios}\n\nAndroid: ${feedData.instructions.android}`,
                [{ text: 'Got it!' }]
              );
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('[CalendarScreen] Error getting feed URL:', error);
      Alert.alert('Error', 'Failed to get calendar feed URL. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await loadCalendarData();
    setRefreshing(false);
  };

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateHeader = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const dayEvents = getEventsForDate(selectedDate);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading your schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Schedule</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={shareCalendarFeed}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncButton, (syncing || error) && styles.syncButtonDisabled]}
            onPress={syncToPhoneCalendar}
            disabled={syncing || !!error}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialCommunityIcons name="sync" size={16} color="white" />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Sync to Device'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar */}
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={{
          ...markedDates,
          [selectedDate]: {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: theme.primary,
          },
        }}
        theme={{
          backgroundColor: theme.surface,
          calendarBackground: theme.surface,
          textSectionTitleColor: theme.textSecondary,
          selectedDayBackgroundColor: theme.primary,
          selectedDayTextColor: 'white',
          todayTextColor: theme.primary,
          dayTextColor: theme.text,
          textDisabledColor: theme.textTertiary,
          dotColor: theme.primary,
          selectedDotColor: 'white',
          arrowColor: theme.primary,
          disabledArrowColor: theme.textTertiary,
          monthTextColor: theme.text,
          indicatorColor: theme.primary,
          textDayFontWeight: '400',
          textMonthFontWeight: '600',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
        style={styles.calendar}
      />

      {/* Events List */}
      <ScrollView
        style={styles.eventsContainer}
        contentContainerStyle={styles.eventsContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {formatDateHeader(selectedDate)}
          </Text>
          {dayEvents.length > 0 && (
            <View style={styles.eventCount}>
              <Text style={styles.eventCountText}>
                {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color={theme.error}
            />
            <Text style={styles.errorTitle}>Failed to load calendar events</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={loadCalendarData}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="white" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : dayEvents.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={48}
              color={theme.textTertiary}
            />
            <Text style={styles.noEventsText}>No events scheduled for this day</Text>
            <Text style={styles.noEventsSubtext}>
              Check other dates or refresh to see your latest schedule
            </Text>
          </View>
        ) : (
          dayEvents.map((event, index) => (
            <View key={index} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: calendarApiService.getStatusColor(event.status) }
                  ]}>
                    <Text style={styles.statusText}>{event.status}</Text>
                  </View>
                </View>
                
                <View style={styles.eventMeta}>
                  <View style={styles.eventTime}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={theme.primary} />
                    <Text style={styles.eventTimeText}>
                      {calendarApiService.formatEventTime(event.startTime, event.endTime)}
                    </Text>
                  </View>
                  <View style={styles.eventShift}>
                    <Text style={styles.eventShiftText}>
                      {calendarApiService.getShiftDisplayName(event.shift)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.eventDetailRow}>
                  <MaterialCommunityIcons name="wrench" size={16} color={theme.textSecondary} />
                  <Text style={styles.eventDetailText}>
                    {event.jobType} • {event.priority} Priority
                  </Text>
                </View>
                
                {event.location && (
                  <View style={styles.eventDetailRow}>
                    <MaterialCommunityIcons name="map-marker" size={16} color={theme.textSecondary} />
                    <Text style={styles.eventDetailText} numberOfLines={2}>
                      {event.location.street}, {event.location.city}
                    </Text>
                  </View>
                )}
                
                <View style={styles.eventDetailRow}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={theme.textSecondary} />
                  <Text style={styles.eventDetailText}>Job ID: {event.jobId}</Text>
                </View>
                
                {event.description && (
                  <View style={styles.eventDescription}>
                    <Text style={styles.eventDescriptionText} numberOfLines={3}>
                      {event.description}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  syncButtonDisabled: {
    backgroundColor: theme.background,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  calendar: {
    backgroundColor: theme.surface,
    paddingBottom: 16,
  },
  eventsContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  eventsContent: {
    padding: 16,
    paddingBottom: 100,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  eventCount: {
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noEventsText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  noEventsSubtext: {
    fontSize: 14,
    color: theme.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.error,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  eventHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventMeta: {
    gap: 8,
  },
  eventTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  eventShift: {
    alignSelf: 'flex-start',
  },
  eventShiftText: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: `${theme.primary}10`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  eventDetails: {
    padding: 16,
    gap: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
  },
  eventDescription: {
    marginTop: 8,
    padding: 12,
    backgroundColor: `${theme.primary}05`,
    borderRadius: 8,
  },
  eventDescriptionText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});