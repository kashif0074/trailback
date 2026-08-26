import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MapPin, Mic, ShieldAlert, Camera, Image as ImageIcon, X, Check, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useTripStore } from '../store/useTripStore';
import * as Crypto from 'expo-crypto';
import { Marker, MarkerType } from '../db/schema';
import { addMarker } from '../db/database';
import * as Location from 'expo-location';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MarkerActionSheet({ visible, onClose }: Props) {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [note, setNote] = useState('');
  const [selectedType, setSelectedType] = useState<MarkerType | null>(null);
  const [saving, setSaving] = useState(false);
  const trip = useTripStore((state) => state.currentTrip);

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const saveMarker = async (type: MarkerType, mediaUri: string | null = null, explicitNote?: string) => {
    if (!trip) return;

    setSaving(true);
    try {
      let loc = await Location.getLastKnownPositionAsync();
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      const finalNote = explicitNote !== undefined ? explicitNote : note;

      const newMarker: Marker = {
        id: Crypto.randomUUID(),
        tripId: trip.id,
        type,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: Date.now(),
        note: finalNote.trim() || (type === 'landmark' ? 'Photo Landmark' : type === 'voice' ? 'Voice Breadcrumb' : 'Safety Checkpoint'),
        mediaUri,
      };

      await addMarker(newMarker);
      useTripStore.getState().addLiveMarker(newMarker);
      
      setNote('');
      setSelectedType(null);
      onClose();
    } catch (err) {
      console.error('Failed to save marker:', err);
      Alert.alert('Save Failed', 'Unable to capture GPS coordinates for this marker.');
    } finally {
      setSaving(false);
    }
  };

  const handleCameraLandmark = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Camera access is required to capture landmark photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        await saveMarker('landmark', result.assets[0].uri, 'Landmark Photo');
      }
    } catch (err) {
      console.error('Failed to take photo:', err);
    }
  };

  const handleLibraryLandmark = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        await saveMarker('landmark', result.assets[0].uri, 'Landmark Photo');
      }
    } catch (err) {
      console.error('Failed to pick photo:', err);
    }
  };

  const startVoice = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice breadcrumbs.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopVoice = async () => {
    try {
      await audioRecorder.stop();
      setIsRecording(false);
      const uri = audioRecorder.uri;
      if (uri) {
        await saveMarker('voice', uri, `Voice Note (${recordDuration}s)`);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsRecording(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>RECORD TRAIL MARKER</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <X color="#82978A" size={20} />
            </TouchableOpacity>
          </View>
          
          {selectedType === 'checkpoint' ? (
            <View style={styles.checkpointForm}>
              <Text style={styles.formLabel}>Checkpoint Description / Safety Note</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Base camp, water source, bridge cross"
                placeholderTextColor="#4A5B53"
                value={note}
                onChangeText={setNote}
                autoFocus
              />
              <View style={styles.formActionRow}>
                <TouchableOpacity 
                  style={styles.cancelFormBtn} 
                  onPress={() => setSelectedType(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelFormText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveBtn} 
                  onPress={() => saveMarker('checkpoint')}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#060A08" size="small" />
                  ) : (
                    <>
                      <Check color="#060A08" size={18} />
                      <Text style={styles.saveBtnText}>Save Checkpoint</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              {/* Photo Landmark Buttons */}
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCameraLandmark} activeOpacity={0.8}>
                  <View style={[styles.iconBox, { backgroundColor: '#2E151B' }]}>
                    <Camera color="#F43F5E" size={22} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Take Photo Landmark</Text>
                    <Text style={styles.actionSub}>Capture visual reference point (split tree, cairn, fork)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={handleLibraryLandmark} activeOpacity={0.8}>
                  <View style={[styles.iconBox, { backgroundColor: '#2E151B' }]}>
                    <ImageIcon color="#F43F5E" size={22} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionTitle}>Choose from Photos</Text>
                    <Text style={styles.actionSub}>Attach photo from your library to this GPS pin</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Voice Breadcrumb Button */}
              <TouchableOpacity 
                style={[styles.actionBtn, isRecording ? styles.recordingBtn : null]} 
                onPress={isRecording ? stopVoice : startVoice}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, isRecording ? { backgroundColor: '#E53935' } : { backgroundColor: '#13261B' }]}>
                  <Mic color={isRecording ? '#FFF' : '#3BE266'} size={22} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, isRecording ? { color: '#FFF' } : null]}>
                    {isRecording ? `Recording... (${formatTimer(recordDuration)})` : 'Record Voice Breadcrumb'}
                  </Text>
                  <Text style={[styles.actionSub, isRecording ? { color: '#FFA0A0' } : null]}>
                    {isRecording ? 'Tap to finish & attach voice note to GPS point' : 'Speak trail observations, hazards, or turns'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Safety Checkpoint Button */}
              <TouchableOpacity style={styles.actionBtn} onPress={() => setSelectedType('checkpoint')} activeOpacity={0.8}>
                <View style={[styles.iconBox, { backgroundColor: '#2B2110' }]}>
                  <ShieldAlert color="#F5A623" size={22} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Safety Checkpoint & Note</Text>
                  <Text style={styles.actionSub}>Mark base camp, emergency shelter, or critical junction</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    backgroundColor: '#0F1A14',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1A2C22',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: '#82978A',
    letterSpacing: 1,
  },
  closeIcon: { padding: 4 },
  actions: { gap: 12 },
  actionGroup: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#0A120D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A2C22',
    gap: 14,
  },
  recordingBtn: {
    backgroundColor: '#2D1616',
    borderColor: '#E53935',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInfo: { flex: 1 },
  actionTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
  },
  actionSub: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    color: '#82978A',
    marginTop: 2,
  },
  checkpointForm: { gap: 12 },
  formLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#82978A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1A2C22',
    backgroundColor: '#060A08',
    color: '#FFF',
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    borderRadius: 12,
    padding: 14,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelFormBtn: {
    flex: 1,
    backgroundColor: '#0A120D',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A2C22',
  },
  cancelFormText: {
    color: '#82978A',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#3BE266',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#060A08',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#82978A',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
});

