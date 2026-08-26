import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pause, Play, Square, Navigation, BatteryCharging, Signal } from 'lucide-react-native';
import { useTripStore, getCompassDirection } from '../../store/useTripStore';
import { MarkerActionSheet } from '../../components/MarkerActionSheet';
import { startLocationTracking, stopLocationTracking } from '../../tasks/locationTask';
import { startSensorFusion, stopSensorFusion } from '../../services/sensorFusion';

export default function ActiveTrackingScreen() {
  const router = useRouter();
  const { 
    status, 
    currentTrip, 
    currentBreadcrumbs, 
    currentMarkers, 
    confidence, 
    distanceUnit, 
    pauseTrip, 
    resumeTrip, 
    endTrip, 
    startReturn 
  } = useTripStore();
  
  const [sheetVisible, setSheetVisible] = useState(false);
  const [heading, setHeading] = useState(233);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Start sensors and GPS
  useEffect(() => {
    startLocationTracking();
    startSensorFusion(setHeading);
    return () => {
      stopSensorFusion();
    };
  }, []);

  // Timer loop
  useEffect(() => {
    let interval: any = null;
    if (status === 'recording') {
      interval = setInterval(() => {
        if (currentTrip?.startTime) {
          const now = Date.now();
          const elapsed = Math.floor((now - currentTrip.startTime) / 1000);
          setElapsedSeconds(elapsed > 0 ? elapsed : 0);
        } else {
          setElapsedSeconds((s) => s + 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, currentTrip?.startTime]);

  const handleTogglePause = () => {
    if (status === 'recording') {
      pauseTrip();
    } else {
      resumeTrip();
    }
  };

  const handleTakeMeBack = () => {
    startReturn();
    router.push('/tracking/return');
  };

  const handleEnd = () => {
    Alert.alert(
      'Finish Expedition',
      'Are you sure you want to complete and save this expedition route?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Finish & Save', 
          style: 'destructive',
          onPress: async () => {
            await stopLocationTracking();
            await endTrip();
            router.replace('/');
          }
        },
      ]
    );
  };

  // Unit formatting
  const distanceMeters = currentTrip?.totalDistance || 0;
  const isMiles = distanceUnit === 'mi';
  const displayDistance = isMiles 
    ? (distanceMeters * 0.000621371).toFixed(2)
    : (distanceMeters / 1000).toFixed(2);
  const unitLabel = isMiles ? 'mi' : 'km';

  // Format Elapsed Time string
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Calculate Pace (min/km or min/mi)
  const calculatePace = () => {
    const dist = isMiles ? distanceMeters * 0.000621371 : distanceMeters / 1000;
    if (dist < 0.05 || elapsedSeconds < 10) return '--';
    const paceMinutes = (elapsedSeconds / 60) / dist;
    if (paceMinutes > 99) return '>99';
    const pMin = Math.floor(paceMinutes);
    const pSec = Math.floor((paceMinutes - pMin) * 60);
    return `${pMin}:${pSec.toString().padStart(2, '0')}`;
  };

  const directionText = getCompassDirection(heading);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#82978A" size={16} />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>
        
        <View style={styles.trackingBadge}>
          <View style={[styles.trackingDot, status === 'paused' ? { backgroundColor: '#F5A623' } : null]} />
          <Text style={[styles.trackingText, status === 'paused' ? { color: '#F5A623' } : null]}>
            {status === 'paused' ? 'PAUSED' : 'TRACKING'}
          </Text>
        </View>

        <View style={styles.batteryBadge}>
          <BatteryCharging color="#82978A" size={14} />
          <Text style={styles.batteryText}>OFFLINE</Text>
        </View>
      </View>

      {/* GPS Confidence Pill */}
      <View style={styles.confidenceWrapper}>
        <View style={styles.confidencePill}>
          <Signal color={confidence === 'low' ? '#E53935' : '#3BE266'} size={16} />
          <Text style={[styles.confidenceText, confidence === 'low' ? { color: '#E53935' } : null]}>
            {confidence === 'high' ? 'High — GPS + Compass fusion' : confidence === 'medium' ? 'Medium — GPS Lock' : 'Low — Sensor Estimating'}
          </Text>
        </View>
      </View>

      {/* Compass Visual Area */}
      <View style={styles.compassArea}>
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
      </View>

      {/* Heading Text */}
      <View style={styles.headingTextContainer}>
        <Text style={styles.headingDegrees}>{Math.round(heading).toString().padStart(3, '0')}°</Text>
        <Text style={styles.headingDirection}>{directionText}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{displayDistance}</Text>
          <Text style={styles.statUnit}>{unitLabel}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{formatTimer(elapsedSeconds)}</Text>
          <Text style={styles.statUnit}>h:m:s</Text>
          <Text style={styles.statLabel}>Elapsed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{calculatePace()}</Text>
          <Text style={styles.statUnit}>min/{unitLabel}</Text>
          <Text style={styles.statLabel}>Pace</Text>
        </View>
      </View>

      {/* Status Footer */}
      <View style={styles.statusFooter}>
        <View style={styles.statusItem}>
          <View style={[styles.trackingDot, { backgroundColor: '#3BE266', marginRight: 8 }]} />
          <Text style={styles.statusFooterText}>{currentBreadcrumbs.length} GPS points</Text>
        </View>
        <View style={styles.statusItem}>
          <View style={styles.phoneIconMock} />
          <Text style={styles.statusFooterText}>{currentMarkers.length} POI saved</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.fabBtn} onPress={() => setSheetVisible(true)} activeOpacity={0.8}>
          <Plus color="#3BE266" size={26} />
        </TouchableOpacity>

        <View style={styles.mainActions}>
          <TouchableOpacity 
            style={[styles.pauseBtn, status === 'paused' ? styles.resumeBtn : null]} 
            onPress={handleTogglePause}
            activeOpacity={0.8}
          >
            {status === 'paused' ? (
              <>
                <Play color="#060A08" size={20} fill="#060A08" />
                <Text style={styles.resumeText}>Resume</Text>
              </>
            ) : (
              <>
                <Pause color="#3BE266" size={20} fill="#3BE266" />
                <Text style={styles.pauseText}>Pause</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.takeMeBackBtn} onPress={handleTakeMeBack} activeOpacity={0.85}>
            <ArrowLeft color="#060A08" size={20} />
            <Text style={styles.takeMeBackText}>Take Me Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.stopBtn} onPress={handleEnd} activeOpacity={0.8}>
            <Square color="#E53935" size={18} fill="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      <MarkerActionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  trackingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3BE266' },
  trackingText: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 12, letterSpacing: 1 },
  batteryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F1A14', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#1A2C22' },
  batteryText: { color: '#82978A', fontFamily: 'DMMono_500Medium', fontSize: 10 },
  confidenceWrapper: { alignItems: 'center', marginTop: 24 },
  confidencePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0F1A14', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1A2C22' },
  confidenceText: { color: '#3BE266', fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  compassArea: { alignItems: 'center', marginTop: 28 },
  compassOuter: { width: 280, height: 280, borderRadius: 140, backgroundColor: '#0A120D', borderWidth: 1, borderColor: '#1A2C22', justifyContent: 'center', alignItems: 'center' },
  compassInner: { width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: '#1A2C22', justifyContent: 'center', alignItems: 'center' },
  compassLabel: { position: 'absolute', fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#4A5B53' },
  labelN: { top: 10, color: '#E53935' },
  labelE: { right: 10 },
  labelS: { bottom: 10 },
  labelW: { left: 10 },
  compassNeedleContainer: { position: 'absolute', width: 240, height: 240, justifyContent: 'center', alignItems: 'center' },
  compassNeedle: { width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 100, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#3BE266', position: 'absolute', top: 20 },
  compassCenterDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#060A08', borderWidth: 4, borderColor: '#3BE266', position: 'absolute' },
  headingTextContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', marginTop: 16, gap: 8 },
  headingDegrees: { fontSize: 52, fontFamily: 'Outfit_700Bold', color: '#3BE266' },
  headingDirection: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#82978A' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginTop: 16 },
  statBox: { flex: 1, backgroundColor: '#0F1A14', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1A2C22' },
  statVal: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  statUnit: { fontSize: 10, fontFamily: 'DMMono_500Medium', color: '#82978A', marginTop: 2, marginBottom: 4 },
  statLabel: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: '#4A5B53' },
  statusFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30, marginTop: 16 },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  statusFooterText: { fontSize: 12, fontFamily: 'DMMono_400Regular', color: '#82978A' },
  phoneIconMock: { width: 8, height: 12, borderRadius: 2, borderWidth: 1, borderColor: '#3BE266', marginRight: 8 },
  bottomControls: { position: 'absolute', bottom: 36, left: 20, right: 20 },
  fabBtn: { alignSelf: 'flex-end', width: 56, height: 56, borderRadius: 16, backgroundColor: '#0F1A14', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1A2C22', marginBottom: 16 },
  mainActions: { flexDirection: 'row', gap: 12, height: 60 },
  pauseBtn: { flex: 1, backgroundColor: '#0F1A14', borderRadius: 18, borderWidth: 1, borderColor: '#1A2C22', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  resumeBtn: { backgroundColor: '#3BE266', borderColor: '#3BE266' },
  pauseText: { color: '#3BE266', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  resumeText: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  takeMeBackBtn: { flex: 1.5, backgroundColor: '#F5A623', borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  takeMeBackText: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  stopBtn: { width: 60, backgroundColor: '#2D1616', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4A1C1C' },
});

