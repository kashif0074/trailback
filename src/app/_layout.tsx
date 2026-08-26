import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { initDatabase, seedSampleTripsIfEmpty } from '../db/database';
import { Text, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [fontsLoaded] = useFonts({
    DMMono_400Regular,
    DMMono_500Medium,
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();
        await seedSampleTripsIfEmpty();
      } catch (e) {
        console.warn(e);
      } finally {
        setDbInitialized(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (dbInitialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbInitialized, fontsLoaded]);

  if (!dbInitialized || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Trailback...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#060A08' },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tracking/active" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="tracking/return" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="maps/manager" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#060A08',
  },
  loadingText: {
    color: '#3BE266',
    fontFamily: 'DMMono_500Medium',
    fontSize: 14,
    letterSpacing: 0.5,
  }
});
