import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, TriangleAlert, Target, Battery, Zap, ArrowLeft, PhoneCall, X, ShieldAlert, HeartPulse } from 'lucide-react-native';
import { useTripStore, DistanceUnit, SamplingMode } from '../../store/useTripStore';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    distanceUnit,
    samplingMode,
    bgTracking,
    campMode,
    autoStart,
    preTripShare,
    setDistanceUnit,
    setSamplingMode,
    setBgTracking,
    setCampMode,
    setAutoStart,
    setPreTripShare,
  } = useTripStore();

  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(err => {
      console.error('Failed to open dialer:', err);
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#82978A" size={16} />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.screenTitle}>Settings</Text>

      {/* GPS Tracking Section */}
      <Text style={styles.sectionHeader}>GPS TRACKING</Text>
      <View style={styles.cardGroup}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sampling Profile</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity 
              style={[styles.segmentBtn, samplingMode === 'adaptive' ? styles.segmentActive : null]}
              onPress={() => setSamplingMode('adaptive')}
              activeOpacity={0.8}
            >
              <Zap color={samplingMode === 'adaptive' ? '#060A08' : '#82978A'} size={16} fill={samplingMode === 'adaptive' ? '#060A08' : 'none'} />
              <Text style={samplingMode === 'adaptive' ? styles.segmentTextActive : styles.segmentText}>Adaptive</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.segmentBtn, samplingMode === 'high' ? styles.segmentActive : null]}
              onPress={() => setSamplingMode('high')}
              activeOpacity={0.8}
            >
              <Target color={samplingMode === 'high' ? '#060A08' : '#82978A'} size={16} />
              <Text style={samplingMode === 'high' ? styles.segmentTextActive : styles.segmentText}>High (1s)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.segmentBtn, samplingMode === 'low' ? styles.segmentActive : null]}
              onPress={() => setSamplingMode('low')}
              activeOpacity={0.8}
            >
              <Battery color={samplingMode === 'low' ? '#060A08' : '#82978A'} size={16} />
              <Text style={samplingMode === 'low' ? styles.segmentTextActive : styles.segmentText}>Eco (10s)</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardSubtext}>
            {samplingMode === 'adaptive' 
              ? 'Dynamic frequency: 1-2s when moving or turning, scales down when stationary.'
              : samplingMode === 'high'
              ? 'Continuous 1-second GPS sampling for ultra-precise breadcrumb trail tracking.'
              : 'Battery-saving mode: 10-second intervals for multi-day expeditions.'}
          </Text>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Background Tracking</Text>
              <Text style={styles.cardSubtext}>Continue recording route while screen is locked</Text>
            </View>
            <Switch 
              value={bgTracking} 
              onValueChange={setBgTracking} 
              trackColor={{ false: '#1A2C22', true: '#3BE266' }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>
      </View>

      {/* Display Section */}
      <Text style={styles.sectionHeader}>DISPLAY & UNITS</Text>
      <View style={styles.cardGroup}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Distance Units</Text>
              <Text style={styles.cardSubtext}>Applies to odometer, return guide, and trip logs</Text>
            </View>
            <View style={styles.unitToggle}>
              <TouchableOpacity 
                style={distanceUnit === 'km' ? styles.unitBtnActive : styles.unitBtn}
                onPress={() => setDistanceUnit('km')}
                activeOpacity={0.8}
              >
                <Text style={distanceUnit === 'km' ? styles.unitTextActive : styles.unitText}>km</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={distanceUnit === 'mi' ? styles.unitBtnActive : styles.unitBtn}
                onPress={() => setDistanceUnit('mi')}
                activeOpacity={0.8}
              >
                <Text style={distanceUnit === 'mi' ? styles.unitTextActive : styles.unitText}>mi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Behavior Section */}
      <Text style={styles.sectionHeader}>EXPEDITION BEHAVIOR</Text>
      <View style={styles.cardGroup}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Auto-start on movement</Text>
              <Text style={styles.cardSubtext}>Begin tracking automatically when sustained motion is detected</Text>
            </View>
            <Switch 
              value={autoStart} 
              onValueChange={setAutoStart} 
              trackColor={{ false: '#1A2C22', true: '#3BE266' }}
              thumbColor={'#FFF'}
            />
          </View>
          
          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Camp Mode</Text>
              <Text style={styles.cardSubtext}>Pauses GPS overnight when stationary at campsite</Text>
            </View>
            <Switch 
              value={campMode} 
              onValueChange={setCampMode} 
              trackColor={{ false: '#1A2C22', true: '#3BE266' }}
              thumbColor={'#FFF'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Pre-trip safety share</Text>
              <Text style={styles.cardSubtext}>Generate expedition summary to send before entering dead zones</Text>
            </View>
            <Switch 
              value={preTripShare} 
              onValueChange={setPreTripShare} 
              trackColor={{ false: '#1A2C22', true: '#3BE266' }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>
      </View>

      {/* Return Navigation & Voice Guidance Section */}
      <Text style={styles.sectionHeader}>RETURN NAVIGATION & VOICE</Text>
      <View style={styles.cardGroup}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Spoken Turn Directions</Text>
              <Text style={styles.cardSubtext}>Offline voice synthesis announces turns at 50m and execution</Text>
            </View>
            <Switch 
              value={useTripStore((s) => s.voiceGuidanceEnabled)} 
              onValueChange={(val) => useTripStore.getState().setVoiceGuidanceEnabled(val)} 
              trackColor={{ false: '#1A2C22', true: '#3BE266' }}
              thumbColor={'#FFF'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={styles.cardTitle}>Off-Trail Alert Threshold</Text>
              <Text style={styles.cardSubtext}>Trigger warning when straying away from recorded path</Text>
            </View>
            <View style={styles.unitToggle}>
              <TouchableOpacity 
                style={useTripStore((s) => s.offRouteSensitivityMeters) === 20 ? styles.unitBtnActive : styles.unitBtn}
                onPress={() => useTripStore.getState().setOffRouteSensitivity(20)}
                activeOpacity={0.8}
              >
                <Text style={useTripStore((s) => s.offRouteSensitivityMeters) === 20 ? styles.unitTextActive : styles.unitText}>20m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={useTripStore((s) => s.offRouteSensitivityMeters) === 30 ? styles.unitBtnActive : styles.unitBtn}
                onPress={() => useTripStore.getState().setOffRouteSensitivity(30)}
                activeOpacity={0.8}
              >
                <Text style={useTripStore((s) => s.offRouteSensitivityMeters) === 30 ? styles.unitTextActive : styles.unitText}>30m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={useTripStore((s) => s.offRouteSensitivityMeters) === 50 ? styles.unitBtnActive : styles.unitBtn}
                onPress={() => useTripStore.getState().setOffRouteSensitivity(50)}
                activeOpacity={0.8}
              >
                <Text style={useTripStore((s) => s.offRouteSensitivityMeters) === 50 ? styles.unitTextActive : styles.unitText}>50m</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Emergency Section */}
      <View style={styles.cardGroup}>
        <TouchableOpacity 
          style={styles.emergencyCard}
          onPress={() => setEmergencyModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.emergencyIconBox}>
            <TriangleAlert color="#E53935" size={20} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.emergencyTitle}>Offline Emergency Info</Text>
            <Text style={styles.emergencySubtext}>Emergency contacts (1122, 112) & medical notes</Text>
          </View>
          <ChevronRight color="#82978A" size={20} />
        </TouchableOpacity>
      </View>

      {/* Emergency Info Modal */}
      <Modal 
        visible={emergencyModalVisible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setEmergencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.emergencyIconBoxSmall}>
                  <ShieldAlert color="#E53935" size={20} />
                </View>
                <Text style={styles.modalTitle}>Emergency Contacts</Text>
              </View>
              <TouchableOpacity onPress={() => setEmergencyModalVisible(false)} style={styles.closeBtn}>
                <X color="#82978A" size={20} />
              </TouchableOpacity>
            </View>

            {/* Emergency Contacts Cards */}
            <Text style={styles.modalSectionLabel}>DIRECT DISPATCH CONTACTS</Text>
            <View style={styles.contactList}>
              <TouchableOpacity 
                style={styles.contactCard} 
                onPress={() => handleCall('1122')}
                activeOpacity={0.8}
              >
                <View style={styles.contactIconBox}>
                  <PhoneCall color="#3BE266" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>Rescue 1122</Text>
                  <Text style={styles.contactDesc}>Emergency Ambulance, Fire & Disaster Rescue</Text>
                </View>
                <View style={styles.callPill}>
                  <Text style={styles.callPillText}>Call 1122</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.contactCard} 
                onPress={() => handleCall('112')}
                activeOpacity={0.8}
              >
                <View style={styles.contactIconBox}>
                  <PhoneCall color="#3BE266" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>Emergency 112</Text>
                  <Text style={styles.contactDesc}>Universal Emergency / GSM Standard Service</Text>
                </View>
                <View style={styles.callPill}>
                  <Text style={styles.callPillText}>Call 112</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Offline Safety Notes */}
            <View style={styles.safetyInfoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <HeartPulse color="#E53935" size={16} />
                <Text style={styles.safetyInfoTitle}>In Case of Severe Distress:</Text>
              </View>
              <Text style={styles.safetyInfoText}>
                • Activate SOS Mode in Return navigation to broadcast GPS coordinates via Bluetooth and beacon strobe.{'\n'}
                • Emergency services (1122 / 112) can be dialed directly with one tap even when offline or low signal.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setEmergencyModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#82978A', fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  screenTitle: { fontSize: 32, fontFamily: 'Outfit_700Bold', color: '#FFF', paddingHorizontal: 20, marginTop: 16, marginBottom: 24 },
  sectionHeader: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8 },
  cardGroup: { paddingHorizontal: 20, marginBottom: 32 },
  card: { backgroundColor: '#0F1A14', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1A2C22' },
  cardTitle: { fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: '#FFF', marginBottom: 4 },
  cardSubtext: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#82978A', lineHeight: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTextWrap: { flex: 1, paddingRight: 16 },
  divider: { height: 1, backgroundColor: '#1A2C22', marginVertical: 20 },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#060A08', borderRadius: 12, padding: 4, marginTop: 12, marginBottom: 16, borderWidth: 1, borderColor: '#1A2C22' },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 8, borderRadius: 8 },
  segmentActive: { backgroundColor: '#3BE266' },
  segmentText: { fontFamily: 'Outfit_600SemiBold', color: '#82978A', fontSize: 14 },
  segmentTextActive: { fontFamily: 'Outfit_600SemiBold', color: '#060A08', fontSize: 14 },
  unitToggle: { flexDirection: 'row', backgroundColor: '#1A2C22', borderRadius: 8, padding: 4 },
  unitBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  unitBtnActive: { backgroundColor: '#3BE266', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  unitText: { fontFamily: 'Outfit_600SemiBold', color: '#82978A' },
  unitTextActive: { fontFamily: 'Outfit_600SemiBold', color: '#060A08' },
  emergencyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F1A14', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1A2C22' },
  emergencyIconBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#2D1616', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  emergencyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#E53935', marginBottom: 4 },
  emergencySubtext: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#82978A', lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0F1A14', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1A2C22' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  emergencyIconBoxSmall: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#2D1616', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  closeBtn: { padding: 6 },
  modalSectionLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1, marginBottom: 12 },
  contactList: { gap: 12, marginBottom: 20 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A120D', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1A2C22', gap: 12 },
  contactIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#16281D', justifyContent: 'center', alignItems: 'center' },
  contactName: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  contactDesc: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: '#82978A', marginTop: 2 },
  callPill: { backgroundColor: '#3BE266', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  callPillText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#060A08' },
  safetyInfoBox: { backgroundColor: '#1A1212', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#331B1B', marginBottom: 20 },
  safetyInfoTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: '#E53935' },
  safetyInfoText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#C0A0A0', lineHeight: 18 },
  modalCloseButton: { backgroundColor: '#1A2C22', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCloseButtonText: { color: '#FFF', fontFamily: 'Outfit_600SemiBold', fontSize: 15 }
});
