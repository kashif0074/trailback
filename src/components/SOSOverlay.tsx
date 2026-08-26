import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { PhoneCall } from 'lucide-react-native';

type Props = {
  active: boolean;
  onCancel: () => void;
};

export function SOSOverlay({ active, onCancel }: Props) {
  const [strobe, setStrobe] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');
  
  useKeepAwake(); // Keep screen on during SOS

  useEffect(() => {
    if (active) {
      Location.getLastKnownPositionAsync().then(loc => {
        if (loc) {
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setTimestamp(new Date(loc.timestamp).toLocaleTimeString());
        }
      });

      const interval = setInterval(() => {
        setStrobe(s => !s);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }, 300); // Faster strobe
      
      return () => clearInterval(interval);
    }
  }, [active]);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(err => {
      console.error('Failed to open dialer:', err);
    });
  };

  if (!active) return null;

  return (
    <View style={[styles.container, { backgroundColor: strobe ? '#FFF' : '#F44336' }]}>
      <Text style={[styles.sosText, { color: strobe ? '#F44336' : '#FFF' }]}>SOS</Text>
      
      {coords && (
        <View style={styles.coordsBox}>
          <Text style={[styles.coordsLabel, { color: strobe ? '#333' : '#FFCDD2' }]}>LAST KNOWN POSITION</Text>
          <Text style={[styles.coordsText, { color: strobe ? '#000' : '#FFF' }]}>
            {coords.lat.toFixed(6)}
          </Text>
          <Text style={[styles.coordsText, { color: strobe ? '#000' : '#FFF' }]}>
            {coords.lng.toFixed(6)}
          </Text>
          <Text style={[styles.timeText, { color: strobe ? '#666' : '#FFCDD2' }]}>
            AT {timestamp}
          </Text>
        </View>
      )}

      {/* Emergency Contacts Direct Dial */}
      <View style={styles.emergencyContactsContainer}>
        <Text style={[styles.emergencyContactsTitle, { color: strobe ? '#333' : '#FFCDD2' }]}>
          EMERGENCY SERVICES
        </Text>
        <View style={styles.emergencyButtonsRow}>
          <TouchableOpacity 
            style={styles.callBtn} 
            onPress={() => handleCall('1122')}
            activeOpacity={0.8}
          >
            <PhoneCall color="#FFF" size={18} />
            <Text style={styles.callBtnText}>Call 1122</Text>
            <Text style={styles.callBtnSubtext}>Rescue</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.callBtn} 
            onPress={() => handleCall('112')}
            activeOpacity={0.8}
          >
            <PhoneCall color="#FFF" size={18} />
            <Text style={styles.callBtnText}>Call 112</Text>
            <Text style={styles.callBtnSubtext}>Universal</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusBox}>
        <Text style={[styles.statusText, { color: strobe ? '#000' : '#FFF' }]}>
          ● BLUETOOTH BROADCASTING
        </Text>
        <Text style={[styles.statusText, { color: strobe ? '#000' : '#FFF' }]}>
          ● STROBE ACTIVE
        </Text>
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>CANCEL SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sosText: {
    fontSize: 96,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 20,
    letterSpacing: -2,
  },
  coordsBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  coordsLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  coordsText: {
    fontSize: 40,
    fontFamily: 'DMMono_500Medium',
    lineHeight: 48,
  },
  timeText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'DMMono_400Regular',
  },
  emergencyContactsContainer: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 32,
    alignItems: 'center',
  },
  emergencyContactsTitle: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 2,
    marginBottom: 12,
  },
  emergencyButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  callBtn: {
    flex: 1,
    backgroundColor: '#0A0F0D',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  callBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  callBtnSubtext: {
    color: '#3BE266',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBox: {
    marginBottom: 36,
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'DMMono_500Medium',
    letterSpacing: 1,
  },
  cancelBtn: {
    backgroundColor: '#0A0F0D',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 40,
  },
  cancelText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  }
});
