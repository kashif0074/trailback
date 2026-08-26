import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Download, Trash2, MapPin, CheckCircle2, HardDrive, Plus } from 'lucide-react-native';

interface MapRegion {
  id: string;
  name: string;
  sizeMB: number;
  downloaded: boolean;
  downloading?: boolean;
  description: string;
}

const INITIAL_REGIONS: MapRegion[] = [
  { id: '1', name: 'Yosemite National Park & Valley', sizeMB: 142, downloaded: true, description: 'High-res topo tiles, contour lines, elevation 10m' },
  { id: '2', name: 'Banff & Lake Louise Alpine', sizeMB: 210, downloaded: false, description: 'Glacier trails, ridge routes, offline contours' },
  { id: '3', name: 'Zion Canyon & Angels Landing', sizeMB: 89, downloaded: true, description: 'Red rock canyons, river paths, shade vectors' },
  { id: '4', name: 'Mount Whitney Trail Zone', sizeMB: 165, downloaded: false, description: 'High altitude switchbacks, portal topo pack' },
  { id: '5', name: 'Grand Canyon Bright Angel', sizeMB: 195, downloaded: false, description: 'Rim-to-rim depth vectors, water points layer' },
];

export default function MapsManagerScreen() {
  const router = useRouter();
  const [regions, setRegions] = useState<MapRegion[]>(INITIAL_REGIONS);

  const totalUsedMB = regions.filter(r => r.downloaded).reduce((acc, r) => acc + r.sizeMB, 0);
  const totalCapacityMB = 4096; // 4 GB simulated offline quota
  const usedPercent = Math.min(100, Math.round((totalUsedMB / totalCapacityMB) * 100));

  const handleDownload = (id: string) => {
    setRegions(prev => prev.map(r => r.id === id ? { ...r, downloading: true } : r));
    setTimeout(() => {
      setRegions(prev => prev.map(r => r.id === id ? { ...r, downloading: false, downloaded: true } : r));
      Alert.alert('Map Pack Downloaded', 'The map pack is now cached locally for 100% offline navigation.');
    }, 1500);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remove Offline Map',
      `Delete cached offline vector tiles for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setRegions(prev => prev.map(r => r.id === id ? { ...r, downloaded: false } : r));
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: MapRegion }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconBox, item.downloaded ? styles.iconBoxDownloaded : null]}>
          <MapPin color={item.downloaded ? "#3BE266" : "#82978A"} size={22} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardSize}>{item.sizeMB} MB</Text>
            {item.downloaded && (
              <View style={styles.downloadedTag}>
                <CheckCircle2 color="#3BE266" size={12} />
                <Text style={styles.downloadedTagText}>READY OFFLINE</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {item.downloading ? (
        <View style={styles.actionBtn}>
          <ActivityIndicator color="#3BE266" size="small" />
        </View>
      ) : item.downloaded ? (
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id, item.name)} activeOpacity={0.7}>
          <Trash2 color="#E53935" size={20} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item.id)} activeOpacity={0.8}>
          <Download color="#060A08" size={16} />
          <Text style={styles.downloadBtnText}>Get</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#82978A" size={18} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OFFLINE MAP PACKS</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Storage Gauge Header */}
      <View style={styles.stats}>
        <View style={styles.statsRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HardDrive color="#3BE266" size={16} />
            <Text style={styles.statsLabel}>OFFLINE STORAGE CACHE</Text>
          </View>
          <Text style={styles.statsText}>{totalUsedMB} MB <Text style={{ color: '#82978A', fontSize: 13 }}>/ 4.0 GB</Text></Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.max(5, usedPercent)}%` }]} />
        </View>
        <Text style={styles.statsSubtext}>Vector contour tiles are preserved locally on-device for signal-free excursions.</Text>
      </View>

      <FlatList 
        data={regions}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A08' },
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
  stats: {
    padding: 20,
    backgroundColor: '#0F1A14',
    borderBottomWidth: 1,
    borderBottomColor: '#1A2C22',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statsLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#82978A', letterSpacing: 1 },
  statsText: { fontSize: 16, fontFamily: 'DMMono_500Medium', color: '#FFF' },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#060A08',
    borderRadius: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1A2C22',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3BE266',
    borderRadius: 3,
  },
  statsSubtext: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: '#82978A', lineHeight: 16 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F1A14',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A2C22',
    gap: 12,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#16281D', justifyContent: 'center', alignItems: 'center' },
  iconBoxDownloaded: { backgroundColor: '#132E1D', borderWidth: 1, borderColor: '#1F472B' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#FFF' },
  cardDesc: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: '#82978A', marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  cardSize: { fontSize: 11, fontFamily: 'DMMono_500Medium', color: '#82978A' },
  downloadedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  downloadedTagText: { color: '#3BE266', fontSize: 10, fontFamily: 'Outfit_700Bold', letterSpacing: 0.5 },
  actionBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3BE266', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  downloadBtnText: { color: '#060A08', fontFamily: 'Outfit_700Bold', fontSize: 13 },
});

