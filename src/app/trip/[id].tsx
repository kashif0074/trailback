import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share as RNShare } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Share2, RefreshCcw, Trash2, MapPin, Mic, ShieldAlert, Navigation, Calendar, Clock, Compass } from 'lucide-react-native';
import Svg, { Path, Circle, Polyline, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getTripById, getBreadcrumbsForTrip, getMarkersForTrip, deleteTrip } from '../../db/database';
import { Trip, Breadcrumb, Marker } from '../../db/schema';
import { useTripStore } from '../../store/useTripStore';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const distanceUnit = useTripStore((state) => state.distanceUnit);
  const startReturnWithTrip = useTripStore((state) => state.startReturnWithTrip);
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) {
      getTripById(id).then(setTrip);
      getBreadcrumbsForTrip(id).then(setBreadcrumbs);
      getMarkersForTrip(id).then(setMarkers);
    }
  }, [id]);

  const isMiles = distanceUnit === 'mi';
  const unitLabel = isMiles ? 'mi' : 'km';

  // SVG Route Map projection
  const svgMapData = useMemo(() => {
    if (breadcrumbs.length === 0) return null;

    const lats = breadcrumbs.map(b => b.latitude);
    const lngs = breadcrumbs.map(b => b.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lngSpan = Math.max(0.0001, maxLng - minLng);

    const width = 320;
    const height = 220;
    const padding = 28;

    const toSvgX = (lng: number) => padding + ((lng - minLng) / lngSpan) * (width - 2 * padding);
    const toSvgY = (lat: number) => height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);

    const pointsString = breadcrumbs.map(b => `${toSvgX(b.longitude)},${toSvgY(b.latitude)}`).join(' ');

    const markerPoints = markers.map(m => ({
      ...m,
      x: toSvgX(m.longitude),
      y: toSvgY(m.latitude),
    }));

    const startPt = { x: toSvgX(breadcrumbs[0].longitude), y: toSvgY(breadcrumbs[0].latitude) };
    const endPt = { x: toSvgX(breadcrumbs[breadcrumbs.length - 1].longitude), y: toSvgY(breadcrumbs[breadcrumbs.length - 1].latitude) };

    return {
      pointsString,
      startPt,
      endPt,
      markerPoints,
      width,
      height,
    };
  }, [breadcrumbs, markers]);

  const handleExportGPX = async () => {
    if (!trip || breadcrumbs.length === 0) {
      Alert.alert('No Route Data', 'This trip has no recorded GPS points to export.');
      return;
    }

    setExporting(true);
    try {
      const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trailback Navigation" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${trip.name || 'Trailback Route'}</name>
    <time>${new Date(trip.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${trip.name || 'Trail Route'}</name>
    <trkseg>
      ${breadcrumbs.map(b => `<trkpt lat="${b.latitude}" lon="${b.longitude}">
        <time>${new Date(b.timestamp).toISOString()}</time>
        ${b.heading !== null ? `<course>${b.heading}</course>` : ''}
      </trkpt>`).join('\n      ')}
    </trkseg>
  </trk>
  ${markers.map(m => `<wpt lat="${m.latitude}" lon="${m.longitude}">
    <name>${m.type.toUpperCase()}: ${m.note || 'Marker'}</name>
    <time>${new Date(m.timestamp).toISOString()}</time>
  </wpt>`).join('\n  ')}
</gpx>`;

      const filename = `trailback_${trip.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'route'}.gpx`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, gpxContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/gpx+xml',
          dialogTitle: 'Export GPX Route',
          UTI: 'com.topografix.gpx',
        });
      } else {
        await RNShare.share({
          message: gpxContent,
          title: filename,
        });
      }
    } catch (err) {
      console.error('Failed to export GPX:', err);
      Alert.alert('Export Notice', 'Could not open share sheet directly on this device.');
    } finally {
      setExporting(false);
    }
  };

  const handleReWalk = () => {
    if (!trip) return;
    startReturnWithTrip(trip, breadcrumbs, markers);
    router.push('/tracking/return');
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Expedition',
      'Are you sure you want to delete this trip record and all its GPS breadcrumbs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (trip) {
              await deleteTrip(trip.id);
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.loading}>
        <Compass color="#3BE266" size={32} />
        <Text style={styles.loadingText}>LOADING EXPEDITION...</Text>
      </SafeAreaView>
    );
  }

  const durationStr = trip.endTime 
    ? new Date(trip.endTime - trip.startTime).toISOString().substr(11, 8) 
    : 'IN PROGRESS';

  const displayDistance = isMiles 
    ? (trip.totalDistance * 0.000621371).toFixed(2)
    : (trip.totalDistance / 1000).toFixed(2);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#82978A" size={20} />
          <Text style={styles.backText}>Trips</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EXPEDITION DETAILS</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
          <Trash2 color="#E53935" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* SVG Route Map */}
        <View style={styles.mapContainer}>
          {svgMapData ? (
            <Svg width="100%" height={220} viewBox={`0 0 ${svgMapData.width} ${svgMapData.height}`}>
              {/* Background Grid */}
              <Line x1="0" y1="55" x2={svgMapData.width} y2="55" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="0" y1="110" x2={svgMapData.width} y2="110" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="0" y1="165" x2={svgMapData.width} y2="165" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="80" y1="0" x2="80" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="160" y1="0" x2="160" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="240" y1="0" x2="240" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />

              {/* Route Glow & Line */}
              <Polyline
                points={svgMapData.pointsString}
                fill="none"
                stroke="rgba(59, 226, 102, 0.25)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={svgMapData.pointsString}
                fill="none"
                stroke="#3BE266"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Marker Points */}
              {svgMapData.markerPoints.map(m => (
                <G key={m.id}>
                  <Circle cx={m.x} cy={m.y} r="8" fill="rgba(244, 63, 94, 0.3)" />
                  <Circle cx={m.x} cy={m.y} r="4" fill="#F43F5E" />
                </G>
              ))}

              {/* Start & End Points */}
              <Circle cx={svgMapData.startPt.x} cy={svgMapData.startPt.y} r="6" fill="#3BE266" />
              <Circle cx={svgMapData.startPt.x} cy={svgMapData.startPt.y} r="10" stroke="#3BE266" strokeWidth="1.5" fill="none" />

              <Circle cx={svgMapData.endPt.x} cy={svgMapData.endPt.y} r="6" fill="#F5A623" />
              <Circle cx={svgMapData.endPt.x} cy={svgMapData.endPt.y} r="10" stroke="#F5A623" strokeWidth="1.5" fill="none" />
            </Svg>
          ) : (
            <View style={styles.noRouteMap}>
              <Navigation color="#4A5B53" size={32} />
              <Text style={styles.mapText}>No GPS Breadcrumbs Recorded</Text>
            </View>
          )}

          <View style={styles.mapOverlayPill}>
            <Text style={styles.mapOverlayPillText}>{breadcrumbs.length} GPS Points</Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.tripName}>{trip.name || 'Expedition Route'}</Text>
          <View style={styles.tripDateRow}>
            <Calendar color="#82978A" size={14} />
            <Text style={styles.tripDate}>{new Date(trip.startTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TOTAL DISTANCE</Text>
              <Text style={styles.statVal}>{displayDistance} {unitLabel.toUpperCase()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>DURATION</Text>
              <Text style={styles.statVal}>{durationStr}</Text>
            </View>
          </View>
          
          <View style={styles.statBoxFull}>
            <Text style={styles.statLabel}>WAYPOINTS & POI</Text>
            <Text style={styles.statVal}>{markers.length} points of interest recorded</Text>
          </View>
        </View>

        {/* Actions (Re-walk, Export GPX) */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleReWalk} activeOpacity={0.85}>
            <RefreshCcw color="#060A08" size={18} />
            <Text style={styles.actionText}>RE-WALK THIS ROUTE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleExportGPX} activeOpacity={0.85}>
            <Share2 color="#3BE266" size={18} />
            <Text style={styles.actionTextSecondary}>{exporting ? 'EXPORTING...' : 'EXPORT GPX FILE'}</Text>
          </TouchableOpacity>
        </View>

        {/* Markers List Section */}
        {markers.length > 0 && (
          <View style={styles.markersSection}>
            <Text style={styles.markersSectionTitle}>RECORDED MARKERS ({markers.length})</Text>
            <View style={styles.markerList}>
              {markers.map((m, idx) => (
                <View key={m.id} style={styles.markerItem}>
                  <View style={[styles.markerIconBox, m.type === 'landmark' ? styles.landmarkIcon : m.type === 'voice' ? styles.voiceIcon : styles.checkpointIcon]}>
                    {m.type === 'landmark' ? (
                      <MapPin color="#F43F5E" size={18} />
                    ) : m.type === 'voice' ? (
                      <Mic color="#3BE266" size={18} />
                    ) : (
                      <ShieldAlert color="#F5A623" size={18} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.markerTitle}>
                      {m.type === 'landmark' ? 'Photo Landmark' : m.type === 'voice' ? 'Voice Breadcrumb' : 'Safety Checkpoint'} #{idx + 1}
                    </Text>
                    <Text style={styles.markerNote}>{m.note || 'No description notes.'}</Text>
                    <Text style={styles.markerCoords}>
                      {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)} • {new Date(m.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060A08', gap: 12 },
  loadingText: { color: '#3BE266', fontFamily: 'DMMono_500Medium', fontSize: 13, letterSpacing: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2C22',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  headerTitle: { color: '#FFF', fontSize: 13, fontFamily: 'Outfit_700Bold', letterSpacing: 1 },
  deleteBtn: { padding: 8, backgroundColor: '#1A1212', borderRadius: 8 },
  content: { flex: 1 },
  mapContainer: {
    backgroundColor: '#0A120D',
    height: 220,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2C22',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  noRouteMap: { alignItems: 'center', gap: 8 },
  mapText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: '#4A5B53' },
  mapOverlayPill: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(15, 26, 20, 0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#1A2C22' },
  mapOverlayPillText: { color: '#3BE266', fontFamily: 'DMMono_500Medium', fontSize: 10 },
  statsCard: {
    backgroundColor: '#0F1A14',
    padding: 20,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A2C22',
  },
  tripName: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  tripDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 18 },
  tripDate: { fontSize: 12, fontFamily: 'DMMono_400Regular', color: '#82978A' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statBox: { flex: 1 },
  statBoxFull: { marginTop: 2 },
  statLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#82978A', marginBottom: 4, letterSpacing: 1 },
  statVal: { fontSize: 18, fontFamily: 'DMMono_500Medium', color: '#3BE266' },
  actions: { flexDirection: 'column', gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3BE266', padding: 16, borderRadius: 16, gap: 10 },
  actionText: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 14, letterSpacing: 0.5 },
  actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1A14', padding: 16, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: '#1A2C22' },
  actionTextSecondary: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 14, letterSpacing: 0.5 },
  markersSection: { paddingHorizontal: 16, marginTop: 8 },
  markersSectionTitle: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1, marginBottom: 12 },
  markerList: { gap: 10 },
  markerItem: { flexDirection: 'row', backgroundColor: '#0F1A14', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1A2C22', gap: 12, alignItems: 'center' },
  markerIconBox: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  landmarkIcon: { backgroundColor: '#2E151B' },
  voiceIcon: { backgroundColor: '#13261B' },
  checkpointIcon: { backgroundColor: '#2B2110' },
  markerTitle: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 13 },
  markerNote: { color: '#D0DCD5', fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  markerCoords: { color: '#82978A', fontFamily: 'DMMono_400Regular', fontSize: 10, marginTop: 4 }
});

