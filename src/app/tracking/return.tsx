import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Flag, 
  MapPin, 
  SignalMedium, 
  Navigation, 
  Compass, 
  Map, 
  Volume2, 
  VolumeX, 
  ListOrdered, 
  CornerUpLeft, 
  CornerUpRight, 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowUpRight, 
  RotateCcw, 
  TriangleAlert, 
  X, 
  CheckCircle2, 
  Radio, 
  Square
} from 'lucide-react-native';
import Svg, { Path, Circle, Polyline, Line, G, Marker as SvgMarker, Polygon, Text as SvgText } from 'react-native-svg';
import { useTripStore, calculateBearing, calculateHaversineDistance, getCompassDirection } from '../../store/useTripStore';
import { Maneuver, ManeuverType } from '../../services/turnByTurnEngine';
import { SOSOverlay } from '../../components/SOSOverlay';
import { startSensorFusion, stopSensorFusion } from '../../services/sensorFusion';
import { startLocationTracking, stopLocationTracking } from '../../tasks/locationTask';

export default function ReturnTrackingScreen() {
  const router = useRouter();
  const { 
    currentTrip, 
    currentBreadcrumbs, 
    currentMarkers, 
    distanceUnit, 
    confidence,
    reverseRoutePoints,
    activeManeuvers,
    activeManeuverIndex,
    navEvaluation,
    voiceMuted,
    toggleVoiceMute,
    initTurnByTurn,
    endTrip,
  } = useTripStore();

  const [sosActive, setSosActive] = useState(false);
  const [heading, setHeading] = useState(62);
  const [viewMode, setViewMode] = useState<'map' | 'compass'>('map');
  const [stepsModalVisible, setStepsModalVisible] = useState(false);

  useEffect(() => {
    startLocationTracking();
    startSensorFusion(setHeading);
    initTurnByTurn();
    return () => {
      stopSensorFusion();
    };
  }, []);

  const isMiles = distanceUnit === 'mi';
  const unitLabel = isMiles ? 'mi' : 'km';

  const formatDist = (meters: number) => {
    if (isMiles) {
      const miles = meters * 0.000621371;
      return miles >= 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(meters * 3.28084)} ft`;
    }
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  };

  const currentManeuver = navEvaluation?.currentManeuver || activeManeuvers[0] || null;
  const nextManeuver = navEvaluation?.nextUpcomingManeuver || (activeManeuvers.length > 1 ? activeManeuvers[1] : null);
  const remainingDist = navEvaluation?.totalRemainingDistance ?? (currentTrip?.totalDistance || 4120);
  const distToNextTurn = navEvaluation?.distanceToManeuver ?? 120;
  const progressPercent = navEvaluation?.progressPercent ?? 15;
  const isOffRoute = navEvaluation?.isOffRoute ?? false;

  // Estimate return time
  const estSeconds = navEvaluation?.estimatedRemainingSeconds ?? Math.round(remainingDist / 1.25);
  const estMinutes = Math.max(1, Math.round(estSeconds / 60));
  const estTimeStr = estMinutes >= 60 
    ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m`
    : `${estMinutes} min`;

  // Compute SVG Vector Map Coordinates
  const svgMapData = useMemo(() => {
    const points = reverseRoutePoints.length > 0 ? reverseRoutePoints : currentBreadcrumbs;
    if (points.length === 0) return null;

    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.0002, maxLat - minLat);
    const lngSpan = Math.max(0.0002, maxLng - minLng);

    const width = 340;
    const height = 260;
    const padding = 32;

    const toSvgX = (lng: number) => padding + ((lng - minLng) / lngSpan) * (width - 2 * padding);
    const toSvgY = (lat: number) => height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);

    const pointsString = points.map(p => `${toSvgX(p.longitude)},${toSvgY(p.latitude)}`).join(' ');

    // Generate directional chevrons along path
    const chevrons: { x: number; y: number; angle: number }[] = [];
    const step = Math.max(1, Math.floor(points.length / 7));
    for (let i = 0; i < points.length - 1; i += step) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const x = (toSvgX(p1.longitude) + toSvgX(p2.longitude)) / 2;
      const y = (toSvgY(p1.latitude) + toSvgY(p2.latitude)) / 2;
      const angle = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      chevrons.push({ x, y, angle });
    }

    const startPt = { x: toSvgX(points[0].longitude), y: toSvgY(points[0].latitude) };
    const destinationPt = { x: toSvgX(points[points.length - 1].longitude), y: toSvgY(points[points.length - 1].latitude) };

    // User location representation
    const userLat = navEvaluation?.closestLatitude || points[0].latitude;
    const userLng = navEvaluation?.closestLongitude || points[0].longitude;
    const userPt = { x: toSvgX(userLng), y: toSvgY(userLat) };

    const maneuverPts = activeManeuvers.map(m => ({
      ...m,
      x: toSvgX(m.longitude),
      y: toSvgY(m.latitude),
    }));

    return {
      pointsString,
      startPt,
      destinationPt,
      userPt,
      chevrons,
      maneuverPts,
      width,
      height,
    };
  }, [reverseRoutePoints, currentBreadcrumbs, navEvaluation, activeManeuvers]);

  // Turn Icon Resolver
  const renderManeuverIcon = (type?: ManeuverType, size = 32, color = '#060A08') => {
    switch (type) {
      case 'left':
        return <CornerUpLeft color={color} size={size} strokeWidth={2.5} />;
      case 'right':
        return <CornerUpRight color={color} size={size} strokeWidth={2.5} />;
      case 'sharp_left':
        return <CornerUpLeft color={color} size={size} strokeWidth={3} />;
      case 'sharp_right':
        return <CornerUpRight color={color} size={size} strokeWidth={3} />;
      case 'slight_left':
        return <ArrowUpLeft color={color} size={size} strokeWidth={2.5} />;
      case 'slight_right':
        return <ArrowUpRight color={color} size={size} strokeWidth={2.5} />;
      case 'u_turn':
        return <RotateCcw color={color} size={size} strokeWidth={2.5} />;
      case 'arrival':
        return <Flag color={color} size={size} fill={color} />;
      case 'pass_landmark':
      case 'pass_checkpoint':
        return <MapPin color={color} size={size} fill={color} />;
      default:
        return <ArrowUp color={color} size={size} strokeWidth={2.5} />;
    }
  };

  const handleEndNavigation = () => {
    Alert.alert(
      'Finish Return Trip',
      'Have you arrived at your destination / trailhead?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete & Save', 
          style: 'default',
          onPress: async () => {
            await stopLocationTracking();
            await endTrip();
            router.replace('/');
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Controls Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#82978A" size={18} />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        <View style={styles.modeToggle}>
          <TouchableOpacity 
            style={[styles.modeBtn, viewMode === 'map' ? styles.modeBtnActive : null]}
            onPress={() => setViewMode('map')}
            activeOpacity={0.8}
          >
            <Map color={viewMode === 'map' ? '#060A08' : '#82978A'} size={15} />
            <Text style={viewMode === 'map' ? styles.modeTextActive : styles.modeText}>Trail Map</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modeBtn, viewMode === 'compass' ? styles.modeBtnActive : null]}
            onPress={() => setViewMode('compass')}
            activeOpacity={0.8}
          >
            <Compass color={viewMode === 'compass' ? '#060A08' : '#82978A'} size={15} />
            <Text style={viewMode === 'compass' ? styles.modeTextActive : styles.modeText}>Compass</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleVoiceMute} activeOpacity={0.7}>
            {voiceMuted ? <VolumeX color="#E53935" size={18} /> : <Volume2 color="#3BE266" size={18} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn} onPress={() => setSosActive(true)} activeOpacity={0.8}>
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Google Maps-style Turn-by-Turn Instruction Banner */}
      <View style={[styles.navBanner, isOffRoute ? styles.navBannerOffRoute : null]}>
        <View style={[styles.maneuverIconBox, isOffRoute ? styles.maneuverIconBoxAlert : null]}>
          {isOffRoute ? (
            <TriangleAlert color="#060A08" size={30} strokeWidth={2.5} />
          ) : (
            renderManeuverIcon(currentManeuver?.type, 30, '#060A08')
          )}
        </View>
        <View style={styles.bannerInfo}>
          <View style={styles.bannerDistanceRow}>
            <Text style={styles.bannerDistanceVal}>{formatDist(distToNextTurn)}</Text>
            <Text style={styles.bannerDistanceUnit}>ahead</Text>
          </View>
          <Text style={styles.bannerPrimaryText} numberOfLines={1}>
            {navEvaluation?.primaryBannerText || currentManeuver?.instruction || 'Follow recorded return trail'}
          </Text>
          <Text style={styles.bannerSecondaryText} numberOfLines={1}>
            {navEvaluation?.secondaryBannerText || (nextManeuver ? `Then ${nextManeuver.shortInstruction.toLowerCase()}` : 'Guiding back to trailhead')}
          </Text>
        </View>
        <TouchableOpacity style={styles.stepsListBtn} onPress={() => setStepsModalVisible(true)} activeOpacity={0.7}>
          <ListOrdered color="#060A08" size={18} />
        </TouchableOpacity>
      </View>

      {/* Main Navigation Visualization (Map vs Compass) */}
      <View style={styles.viewportArea}>
        {viewMode === 'map' ? (
          <View style={styles.mapCanvas}>
            {svgMapData ? (
              <Svg width="100%" height={260} viewBox={`0 0 ${svgMapData.width} ${svgMapData.height}`}>
                {/* Topo Grid Overlay */}
                <Line x1="0" y1="65" x2={svgMapData.width} y2="65" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="0" y1="130" x2={svgMapData.width} y2="130" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="0" y1="195" x2={svgMapData.width} y2="195" stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="85" y1="0" x2="85" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="170" y1="0" x2="170" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="255" y1="0" x2="255" y2={svgMapData.height} stroke="#13201A" strokeWidth="1" strokeDasharray="4,4" />

                {/* Return Route Glow & Polyline */}
                <Polyline
                  points={svgMapData.pointsString}
                  fill="none"
                  stroke="rgba(59, 226, 102, 0.2)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={svgMapData.pointsString}
                  fill="none"
                  stroke="#3BE266"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Directional Return Chevrons */}
                {svgMapData.chevrons.map((c, i) => (
                  <G key={`chev-${i}`} transform={`translate(${c.x}, ${c.y}) rotate(${c.angle})`}>
                    <Polygon points="0,-6 5,4 0,1 -5,4" fill="#060A08" stroke="#FFF" strokeWidth="1" />
                  </G>
                ))}

                {/* Turn Maneuver Waypoint Dots */}
                {svgMapData.maneuverPts.map((m) => (
                  <G key={m.id}>
                    <Circle cx={m.x} cy={m.y} r="5" fill="#F5A623" stroke="#060A08" strokeWidth="1.5" />
                  </G>
                ))}

                {/* Destination (Trailhead) Pin */}
                <Circle cx={svgMapData.destinationPt.x} cy={svgMapData.destinationPt.y} r="8" fill="#3BE266" stroke="#060A08" strokeWidth="2" />
                <Circle cx={svgMapData.destinationPt.x} cy={svgMapData.destinationPt.y} r="14" stroke="#3BE266" strokeWidth="1.5" fill="none" />

                {/* User Location Puck with Heading Arrow */}
                <G transform={`translate(${svgMapData.userPt.x}, ${svgMapData.userPt.y}) rotate(${heading})`}>
                  <Circle cx="0" cy="0" r="12" fill="rgba(59, 226, 102, 0.3)" />
                  <Circle cx="0" cy="0" r="7" fill="#3BE266" stroke="#FFF" strokeWidth="2" />
                  <Polygon points="0,-16 6,-6 0,-9 -6,-6" fill="#3BE266" stroke="#060A08" strokeWidth="1" />
                </G>
              </Svg>
            ) : (
              <View style={styles.noMapView}>
                <Navigation color="#4A5B53" size={36} />
                <Text style={styles.noMapText}>Synthesizing Vector Trail...</Text>
              </View>
            )}

            <View style={styles.mapStatusPill}>
              <Radio color="#3BE266" size={12} />
              <Text style={styles.mapStatusText}>GPS LOCK • OFFLINE VECTOR TRAIL</Text>
            </View>
          </View>
        ) : (
          <View style={styles.compassView}>
            <View style={styles.compassOuter}>
              <View style={styles.compassInner}>
                <Text style={[styles.compassLabel, styles.labelN]}>N</Text>
                <Text style={[styles.compassLabel, styles.labelE]}>E</Text>
                <Text style={[styles.compassLabel, styles.labelS]}>S</Text>
                <Text style={[styles.compassLabel, styles.labelW]}>W</Text>
                
                <View style={[styles.compassNeedleContainer, { transform: [{ rotate: `${heading}deg` }] }]}>
                  <View style={styles.compassNeedle} />
                  <View style={styles.compassCenterDot} />
                </View>
              </View>
            </View>
            <View style={styles.headingRow}>
              <Text style={styles.headingVal}>{Math.round(heading).toString().padStart(3, '0')}°</Text>
              <Text style={styles.headingDir}>{getCompassDirection(heading)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Retracing Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Route Retraced</Text>
          <Text style={styles.progressVal}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Bottom Telemetry Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryCol}>
            <Text style={styles.telemetryLabel}>REMAINING</Text>
            <Text style={styles.telemetryVal}>{formatDist(remainingDist)}</Text>
          </View>
          <View style={[styles.telemetryCol, styles.telemetryBorder]}>
            <Text style={styles.telemetryLabel}>EST. TIME</Text>
            <Text style={styles.telemetryVal}>{estTimeStr}</Text>
          </View>
          <View style={styles.telemetryCol}>
            <Text style={styles.telemetryLabel}>NEXT TURN</Text>
            <Text style={[styles.telemetryVal, { color: '#F5A623' }]}>{formatDist(distToNextTurn)}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.stepsBtn} onPress={() => setStepsModalVisible(true)} activeOpacity={0.8}>
            <ListOrdered color="#3BE266" size={18} />
            <Text style={styles.stepsBtnText}>Directions ({activeManeuvers.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.finishBtn} onPress={handleEndNavigation} activeOpacity={0.8}>
            <Square color="#E53935" size={16} fill="#E53935" />
            <Text style={styles.finishBtnText}>End Return</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step-by-Step Directions Modal */}
      <Modal
        visible={stepsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStepsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ListOrdered color="#3BE266" size={20} />
                <Text style={styles.modalTitle}>Offline Turn-by-Turn Guide</Text>
              </View>
              <TouchableOpacity onPress={() => setStepsModalVisible(false)} style={styles.closeBtn}>
                <X color="#82978A" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 24 }}>
              {activeManeuvers.map((m, idx) => {
                const isActive = idx === activeManeuverIndex;
                const isPassed = idx < activeManeuverIndex;
                return (
                  <View key={m.id} style={[styles.stepItem, isActive ? styles.stepItemActive : isPassed ? styles.stepItemPassed : null]}>
                    <View style={[styles.stepIconBox, isActive ? styles.stepIconBoxActive : null]}>
                      {renderManeuverIcon(m.type, 20, isActive ? '#060A08' : isPassed ? '#82978A' : '#3BE266')}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepInstruction, isActive ? { color: '#3BE266' } : isPassed ? { color: '#82978A' } : null]}>
                        {m.instruction}
                      </Text>
                      <Text style={styles.stepDistance}>
                        In {formatDist(m.distanceFromPrevious)} • {formatDist(m.distanceToDestination)} from start
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>CURRENT</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SOSOverlay active={sosActive} onCancel={() => setSosActive(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#0F1A14', borderRadius: 20, padding: 3, borderWidth: 1, borderColor: '#1A2C22' },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  modeBtnActive: { backgroundColor: '#3BE266' },
  modeText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 12 },
  modeTextActive: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 12 },
  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0F1A14', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1A2C22' },
  sosBtn: { backgroundColor: '#2D1616', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#4A1C1C' },
  sosText: { color: '#E53935', fontFamily: 'Outfit_700Bold', fontSize: 12 },
  navBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3BE266',
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navBannerOffRoute: {
    backgroundColor: '#F5A623',
  },
  maneuverIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maneuverIconBoxAlert: {
    backgroundColor: '#2D1A06',
  },
  bannerInfo: { flex: 1 },
  bannerDistanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  bannerDistanceVal: { fontSize: 22, fontFamily: 'Outfit_700Bold', color: '#060A08' },
  bannerDistanceUnit: { fontSize: 12, fontFamily: 'DMMono_500Medium', color: '#060A08', opacity: 0.8 },
  bannerPrimaryText: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#060A08', marginTop: 1 },
  bannerSecondaryText: { fontSize: 11, fontFamily: 'DMMono_500Medium', color: '#060A08', opacity: 0.85, marginTop: 1 },
  stepsListBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  viewportArea: { flex: 1, marginHorizontal: 16, marginVertical: 12, justifyContent: 'center', alignItems: 'center' },
  mapCanvas: { width: '100%', height: 260, backgroundColor: '#0A120D', borderRadius: 20, borderWidth: 1, borderColor: '#1A2C22', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  noMapView: { alignItems: 'center', gap: 8 },
  noMapText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  mapStatusPill: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15, 26, 20, 0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#1A2C22' },
  mapStatusText: { color: '#3BE266', fontSize: 9, fontFamily: 'DMMono_500Medium', letterSpacing: 0.5 },
  compassView: { alignItems: 'center', justifyContent: 'center', height: 260 },
  compassOuter: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#0A120D', borderWidth: 1, borderColor: '#1A2C22', justifyContent: 'center', alignItems: 'center' },
  compassInner: { width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: '#1A2C22', justifyContent: 'center', alignItems: 'center' },
  compassLabel: { position: 'absolute', fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#4A5B53' },
  labelN: { top: 8, color: '#E53935' },
  labelE: { right: 8 },
  labelS: { bottom: 8 },
  labelW: { left: 8 },
  compassNeedleContainer: { position: 'absolute', width: 190, height: 190, justifyContent: 'center', alignItems: 'center' },
  compassNeedle: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 80, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#3BE266', position: 'absolute', top: 15 },
  compassCenterDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#060A08', borderWidth: 3, borderColor: '#3BE266', position: 'absolute' },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 },
  headingVal: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: '#3BE266' },
  headingDir: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#82978A' },
  progressContainer: { paddingHorizontal: 20, marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 12 },
  progressVal: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 12 },
  progressBarBg: { height: 6, backgroundColor: '#1A2C22', borderRadius: 3 },
  progressBarFill: { height: '100%', backgroundColor: '#3BE266', borderRadius: 3 },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  telemetryCard: { flexDirection: 'row', backgroundColor: '#0F1A14', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1A2C22' },
  telemetryCol: { flex: 1, alignItems: 'center' },
  telemetryBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1A2C22' },
  telemetryLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 0.5, marginBottom: 4 },
  telemetryVal: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  actionRow: { flexDirection: 'row', gap: 10 },
  stepsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F1A14', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1A2C22' },
  stepsBtnText: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 13 },
  finishBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2D1616', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#4A1C1C' },
  finishBtnText: { color: '#E53935', fontFamily: 'Outfit_700Bold', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0F1A14', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%', borderWidth: 1, borderColor: '#1A2C22' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  closeBtn: { padding: 6 },
  modalList: { gap: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A120D', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1A2C22', gap: 12, marginBottom: 8 },
  stepItemActive: { borderColor: '#3BE266', backgroundColor: '#0E2417' },
  stepItemPassed: { opacity: 0.6 },
  stepIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#16281D', justifyContent: 'center', alignItems: 'center' },
  stepIconBoxActive: { backgroundColor: '#3BE266' },
  stepInstruction: { color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 14 },
  stepDistance: { color: '#82978A', fontFamily: 'DMMono_400Regular', fontSize: 11, marginTop: 2 },
  activeTag: { backgroundColor: '#3BE266', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  activeTagText: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 10 }
});


