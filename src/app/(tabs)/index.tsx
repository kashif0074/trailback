import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTripStore } from '../../store/useTripStore';
import { getTrips, getBreadcrumbsForTrip, getMarkersForTrip } from '../../db/database';
import { Trip } from '../../db/schema';
import { ArrowRight, ArrowLeft, Settings, Activity, Monitor, ChevronRight, Compass, ShieldAlert } from 'lucide-react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const startNewTrip = useTripStore((state) => state.startNewTrip);
  const status = useTripStore((state) => state.status);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const distanceUnit = useTripStore((state) => state.distanceUnit);
  const startReturnWithTrip = useTripStore((state) => state.startReturnWithTrip);
  
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const trips = await getTrips();
      setRecentTrips(trips);
    } catch (err) {
      console.error('Failed to load trips:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleStartTrip = async () => {
    if (status === 'idle') {
      await startNewTrip();
    }
    router.push('/tracking/active');
  };

  const handleTakeMeBack = async () => {
    if (status === 'recording' || status === 'paused' || status === 'returning') {
      router.push('/tracking/return');
      return;
    }

    if (recentTrips.length > 0) {
      const latest = recentTrips[0];
      const breadcrumbs = await getBreadcrumbsForTrip(latest.id);
      const markers = await getMarkersForTrip(latest.id);
      startReturnWithTrip(latest, breadcrumbs, markers);
      router.push('/tracking/return');
    } else {
      router.push('/tracking/active');
    }
  };

  const formatDistance = (meters: number) => {
    if (distanceUnit === 'mi') {
      const miles = meters * 0.000621371;
      return `${miles.toFixed(1)} mi`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const formatDuration = (start: number, end: number | null) => {
    if (!end) return 'Live';
    const diff = Math.max(0, end - start);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const displayedTrips = showAll ? recentTrips : recentTrips.slice(0, 4);

  const renderTripCard = (trip: Trip) => (
    <TouchableOpacity 
      key={trip.id}
      style={styles.tripCard}
      onPress={() => router.push(`/trip/${trip.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.tripIconBox}>
        <Activity color="#3BE266" size={20} />
      </View>
      <View style={styles.tripInfo}>
        <Text style={styles.tripTitle} numberOfLines={1}>{trip.name || 'Expedition Route'}</Text>
        <View style={styles.tripStatsRow}>
          <Text style={styles.tripStatText}>
            {new Date(trip.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={[styles.tripStatText, { color: '#3BE266' }]}>{formatDistance(trip.totalDistance)}</Text>
          <Text style={styles.tripStatText}>{formatDuration(trip.startTime, trip.endTime)}</Text>
        </View>
      </View>
      <ChevronRight color="#82978A" size={16} />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3BE266" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoIcon} />
          <View>
            <Text style={styles.logoText}>Trailback</Text>
            <Text style={styles.logoSubtext}>offline-first trail navigation</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <Settings color="#82978A" size={20} />
        </TouchableOpacity>
      </View>

      {/* Active Trip Banner if tracking currently active */}
      {(status === 'recording' || status === 'paused' || status === 'returning') && (
        <TouchableOpacity 
          style={styles.activeBanner} 
          onPress={() => router.push(status === 'returning' ? '/tracking/return' : '/tracking/active')}
          activeOpacity={0.8}
        >
          <View style={styles.activeBannerDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>
              {status === 'returning' ? 'RETURN NAVIGATION IN PROGRESS' : 'TRIP RECORDING ACTIVE'}
            </Text>
            <Text style={styles.activeBannerSubtext}>
              {currentTrip?.name || 'Ongoing Trail'} • {formatDistance(currentTrip?.totalDistance || 0)}
            </Text>
          </View>
          <ChevronRight color="#3BE266" size={18} />
        </TouchableOpacity>
      )}

      {/* Main Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStartTrip} activeOpacity={0.85}>
          <View style={styles.startIconBox}>
            <ArrowRight color="#060A08" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.startBtnText}>
              {status === 'recording' ? 'Resume Current Trip' : 'Start New Trip'}
            </Text>
            <Text style={styles.startBtnSubtext}>GPS locks in ~5 sec • Offline safe</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.returnBtn} onPress={handleTakeMeBack} activeOpacity={0.85}>
          <View style={styles.returnIconBox}>
            <ArrowLeft color="#F5A623" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.returnBtnText}>Take Me Back</Text>
            <Text style={styles.returnBtnSubtext}>
              {recentTrips.length > 0 ? `Reverse ${recentTrips[0].name || 'last trail'}` : 'Instant reverse trail retracing'}
            </Text>
          </View>
          <ChevronRight color="#F5A623" size={16} style={styles.returnChevron} />
        </TouchableOpacity>
      </View>

      {/* Recent Trips Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RECENT TRIPS</Text>
        {recentTrips.length > 4 && (
          <TouchableOpacity onPress={() => setShowAll(!showAll)}>
            <Text style={styles.seeAllText}>{showAll ? 'Show less' : `See all (${recentTrips.length})`}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listContainer}>
        {recentTrips.length === 0 ? (
          <View style={styles.emptyState}>
            <Compass color="#4A5B53" size={36} />
            <Text style={styles.emptyStateTitle}>No trips recorded yet</Text>
            <Text style={styles.emptyStateSubtext}>Hit 'Start New Trip' to begin your first offline expedition.</Text>
          </View>
        ) : (
          displayedTrips.map(renderTripCard)
        )}
      </View>

      {/* Offline Storage Card */}
      <View style={styles.storageCard}>
        <View style={styles.storageHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Monitor color="#82978A" size={16} />
            <Text style={styles.storageTitle}>OFFLINE STORAGE</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/maps/manager')} activeOpacity={0.7}>
            <Text style={styles.manageText}>Manage Maps</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.storageBarBg}>
          <View style={styles.storageBarFill} />
        </View>

        <View style={styles.storageStats}>
          <View style={styles.storageStatCol}>
            <Text style={styles.storageStatVal}>441 MB</Text>
            <Text style={styles.storageStatLabel}>Map tiles</Text>
          </View>
          <View style={[styles.storageStatCol, styles.storageStatBorder]}>
            <Text style={styles.storageStatVal}>{recentTrips.length > 0 ? `${(recentTrips.length * 1.8).toFixed(1)} MB` : '1.2 MB'}</Text>
            <Text style={styles.storageStatLabel}>Route data</Text>
          </View>
          <View style={styles.storageStatCol}>
            <Text style={styles.storageStatVal}>3.2 GB</Text>
            <Text style={styles.storageStatLabel}>Available</Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 24 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIcon: { width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: '#3BE266', transform: [{ rotate: '45deg' }] },
  logoText: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  logoSubtext: { fontSize: 12, fontFamily: 'DMMono_400Regular', color: '#82978A', marginTop: 2 },
  settingsBtn: { padding: 8, backgroundColor: '#0F1A14', borderRadius: 8, borderWidth: 1, borderColor: '#1A2C22' },
  activeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E2417', borderWidth: 1, borderColor: '#3BE266', padding: 14, borderRadius: 14, marginBottom: 20, gap: 12 },
  activeBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3BE266' },
  activeBannerTitle: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 12, letterSpacing: 0.5 },
  activeBannerSubtext: { color: '#FFF', fontFamily: 'DMMono_400Regular', fontSize: 12, marginTop: 2 },
  actionsContainer: { gap: 14, marginBottom: 30 },
  startBtn: { backgroundColor: '#3BE266', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  startIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  startBtnText: { fontSize: 19, fontFamily: 'Outfit_700Bold', color: '#060A08' },
  startBtnSubtext: { fontSize: 12, fontFamily: 'DMMono_400Regular', color: '#060A08', opacity: 0.85, marginTop: 2 },
  returnBtn: { backgroundColor: '#161208', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#332309' },
  returnIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#452A08', justifyContent: 'center', alignItems: 'center' },
  returnBtnText: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#F5A623' },
  returnBtnSubtext: { fontSize: 12, fontFamily: 'DMMono_400Regular', color: '#82978A', marginTop: 2 },
  returnChevron: { marginLeft: 'auto' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1 },
  seeAllText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#3BE266' },
  listContainer: { gap: 12, marginBottom: 30 },
  tripCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F1A14', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#1A2C22' },
  tripIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#16281D', justifyContent: 'center', alignItems: 'center' },
  tripInfo: { flex: 1 },
  tripTitle: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#FFF', marginBottom: 4 },
  tripStatsRow: { flexDirection: 'row', gap: 12 },
  tripStatText: { fontSize: 12, fontFamily: 'DMMono_500Medium', color: '#82978A' },
  emptyState: { padding: 32, alignItems: 'center', backgroundColor: '#0F1A14', borderRadius: 16, borderWidth: 1, borderColor: '#1A2C22', gap: 8 },
  emptyStateTitle: { color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  emptyStateSubtext: { color: '#82978A', fontFamily: 'Outfit_400Regular', fontSize: 13, textAlign: 'center' },
  storageCard: { backgroundColor: '#0F1A14', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1A2C22' },
  storageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  storageTitle: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1 },
  manageText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#3BE266' },
  storageBarBg: { width: '100%', height: 6, backgroundColor: '#1A2C22', borderRadius: 3, marginBottom: 20 },
  storageBarFill: { width: '42%', height: '100%', backgroundColor: '#3BE266', borderRadius: 3 },
  storageStats: { flexDirection: 'row', justifyContent: 'space-between' },
  storageStatCol: { flex: 1, alignItems: 'center' },
  storageStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1A2C22' },
  storageStatVal: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#FFF', marginBottom: 4 },
  storageStatLabel: { fontSize: 11, fontFamily: 'DMMono_400Regular', color: '#82978A' }
});

