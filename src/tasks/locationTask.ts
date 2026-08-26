import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { addBreadcrumb } from '../db/database';
import { useTripStore } from '../store/useTripStore';
import { Breadcrumb } from '../db/schema';

export const LOCATION_TASK_NAME = 'background-location-task';

let foregroundWatcher: Location.LocationSubscription | null = null;

const processLocation = async (loc: Location.LocationObject) => {
  const tripState = useTripStore.getState();
  if (tripState.status === 'recording' || tripState.status === 'returning') {
    const currentTripId = tripState.currentTrip?.id;
    if (!currentTripId) return;

    const breadcrumb: Breadcrumb = {
      id: Crypto.randomUUID(),
      tripId: currentTripId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp || Date.now(),
      accuracy: loc.coords.accuracy,
      heading: loc.coords.heading,
    };

    // Save to SQLite
    await addBreadcrumb(breadcrumb);

    // Update Zustand store and calculate distance
    tripState.addLiveBreadcrumb(breadcrumb);

    // If in return navigation mode, update turn-by-turn state
    if (tripState.status === 'returning') {
      tripState.updateNavigationLocation(loc.coords.latitude, loc.coords.longitude, loc.coords.heading);
    }

    // Update GPS confidence level
    if (loc.coords.accuracy && loc.coords.accuracy <= 10) {
      tripState.setConfidence('high');
    } else if (loc.coords.accuracy && loc.coords.accuracy <= 30) {
      tripState.setConfidence('medium');
    } else {
      tripState.setConfidence('low');
    }
  }
};

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    for (const loc of locations) {
      await processLocation(loc);
    }
  }
});

export const startLocationTracking = async () => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return;
    }

    // Start real-time foreground watcher for immediate responsive telemetry
    if (!foregroundWatcher) {
      foregroundWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          processLocation(loc);
        }
      );
    }

    // Start background task if permission granted and supported
    try {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus === 'granted') {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000,
            distanceInterval: 5,
            deferredUpdatesInterval: 1500,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'Trailback Tracking Active',
              notificationBody: 'Recording expedition GPS breadcrumbs in background.',
            },
          });
        }
      }
    } catch (bgErr) {
      console.log('Background task registration skipped or not supported:', bgErr);
    }
  } catch (err) {
    console.error('Failed to start location tracking:', err);
  }
};

export const stopLocationTracking = async () => {
  if (foregroundWatcher) {
    foregroundWatcher.remove();
    foregroundWatcher = null;
  }

  try {
    const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (hasTask) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (err) {
    console.log('Stop background task notice:', err);
  }
};

