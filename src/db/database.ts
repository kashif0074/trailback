import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL, Trip, Breadcrumb, Marker } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('trailback.db');
    await db.execAsync(SCHEMA_SQL);
  }
  return db;
}

export async function createTrip(trip: Trip) {
  const database = await initDatabase();
  await database.runAsync(
    'INSERT INTO trips (id, name, startTime, endTime, totalDistance) VALUES (?, ?, ?, ?, ?)',
    trip.id, trip.name, trip.startTime, trip.endTime, trip.totalDistance
  );
}

export async function getTrips(): Promise<Trip[]> {
  const database = await initDatabase();
  return await database.getAllAsync<Trip>('SELECT * FROM trips ORDER BY startTime DESC');
}

export async function getTripById(id: string): Promise<Trip | null> {
  const database = await initDatabase();
  return await database.getFirstAsync<Trip>('SELECT * FROM trips WHERE id = ?', id);
}

export async function updateTripDistance(id: string, distance: number) {
  const database = await initDatabase();
  await database.runAsync('UPDATE trips SET totalDistance = ? WHERE id = ?', distance, id);
}

export async function finishTrip(id: string, endTime: number) {
  const database = await initDatabase();
  await database.runAsync('UPDATE trips SET endTime = ? WHERE id = ?', endTime, id);
}

export async function addBreadcrumb(breadcrumb: Breadcrumb) {
  const database = await initDatabase();
  await database.runAsync(
    'INSERT INTO breadcrumbs (id, tripId, latitude, longitude, timestamp, accuracy, heading) VALUES (?, ?, ?, ?, ?, ?, ?)',
    breadcrumb.id, breadcrumb.tripId, breadcrumb.latitude, breadcrumb.longitude, breadcrumb.timestamp, breadcrumb.accuracy, breadcrumb.heading
  );
}

export async function getBreadcrumbsForTrip(tripId: string): Promise<Breadcrumb[]> {
  const database = await initDatabase();
  return await database.getAllAsync<Breadcrumb>('SELECT * FROM breadcrumbs WHERE tripId = ? ORDER BY timestamp ASC', tripId);
}

export async function addMarker(marker: Marker) {
  const database = await initDatabase();
  await database.runAsync(
    'INSERT INTO markers (id, tripId, type, latitude, longitude, timestamp, note, mediaUri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    marker.id, marker.tripId, marker.type, marker.latitude, marker.longitude, marker.timestamp, marker.note, marker.mediaUri
  );
}

export async function getMarkersForTrip(tripId: string): Promise<Marker[]> {
  const database = await initDatabase();
  return await database.getAllAsync<Marker>('SELECT * FROM markers WHERE tripId = ? ORDER BY timestamp ASC', tripId);
}

export async function deleteTrip(id: string) {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM markers WHERE tripId = ?', id);
  await database.runAsync('DELETE FROM breadcrumbs WHERE tripId = ?', id);
  await database.runAsync('DELETE FROM trips WHERE id = ?', id);
}

export async function updateTripName(id: string, name: string) {
  const database = await initDatabase();
  await database.runAsync('UPDATE trips SET name = ? WHERE id = ?', name, id);
}

export async function seedSampleTripsIfEmpty() {
  const database = await initDatabase();
  const countResult = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM trips');
  if (countResult && countResult.count > 0) {
    return;
  }

  const now = Date.now();
  const dayMs = 86400000;

  // Sample Trip 1: Ridgeline Loop — Eagle Peak
  const trip1: Trip = {
    id: 'sample-1',
    name: 'Ridgeline Loop — Eagle Peak',
    startTime: now - dayMs * 3 - 3600000 * 3.1,
    endTime: now - dayMs * 3,
    totalDistance: 11400,
  };
  await createTrip(trip1);

  // Generate smooth breadcrumb coordinates for Trip 1
  const startLat1 = 37.7425;
  const startLng1 = -119.5985;
  for (let i = 0; i <= 20; i++) {
    const lat = startLat1 + Math.sin(i / 3) * 0.015 + i * 0.001;
    const lng = startLng1 + Math.cos(i / 3) * 0.018 + i * 0.0012;
    await addBreadcrumb({
      id: `sample-bc-1-${i}`,
      tripId: trip1.id,
      latitude: lat,
      longitude: lng,
      timestamp: trip1.startTime + i * 540000,
      accuracy: 4,
      heading: (i * 18) % 360,
    });
  }

  await addMarker({
    id: 'sample-m-1-1',
    tripId: trip1.id,
    type: 'checkpoint',
    latitude: startLat1,
    longitude: startLng1,
    timestamp: trip1.startTime,
    note: 'Base Camp — Trailhead start point',
    mediaUri: null,
  });

  await addMarker({
    id: 'sample-m-1-2',
    tripId: trip1.id,
    type: 'landmark',
    latitude: startLat1 + 0.012,
    longitude: startLng1 + 0.010,
    timestamp: trip1.startTime + 3600000,
    note: 'Eagle Peak Summit — 360 degree panoramic ridge view',
    mediaUri: null,
  });

  // Sample Trip 2: Fern Canyon Out-and-Back
  const trip2: Trip = {
    id: 'sample-2',
    name: 'Fern Canyon Out-and-Back',
    startTime: now - dayMs * 10 - 3600000 * 2.2,
    endTime: now - dayMs * 10,
    totalDistance: 7800,
  };
  await createTrip(trip2);

  const startLat2 = 37.7510;
  const startLng2 = -119.5820;
  for (let i = 0; i <= 15; i++) {
    const lat = startLat2 + (i * 0.003) - (i > 8 ? (i - 8) * 0.0025 : 0);
    const lng = startLng2 + Math.sin(i / 2) * 0.008;
    await addBreadcrumb({
      id: `sample-bc-2-${i}`,
      tripId: trip2.id,
      latitude: lat,
      longitude: lng,
      timestamp: trip2.startTime + i * 500000,
      accuracy: 5,
      heading: 85,
    });
  }

  await addMarker({
    id: 'sample-m-2-1',
    tripId: trip2.id,
    type: 'checkpoint',
    latitude: startLat2,
    longitude: startLng2,
    timestamp: trip2.startTime,
    note: 'Canyon Trailhead — Fresh water spring available',
    mediaUri: null,
  });

  // Sample Trip 3: Storm Ridge Emergency Return
  const trip3: Trip = {
    id: 'sample-3',
    name: 'Storm Ridge Emergency Return',
    startTime: now - dayMs * 18 - 3600000 * 1.5,
    endTime: now - dayMs * 18,
    totalDistance: 4200,
  };
  await createTrip(trip3);

  const startLat3 = 37.7300;
  const startLng3 = -119.6100;
  for (let i = 0; i <= 12; i++) {
    await addBreadcrumb({
      id: `sample-bc-3-${i}`,
      tripId: trip3.id,
      latitude: startLat3 + i * 0.002,
      longitude: startLng3 + i * 0.0018,
      timestamp: trip3.startTime + i * 450000,
      accuracy: 6,
      heading: 215,
    });
  }

  await addMarker({
    id: 'sample-m-3-1',
    tripId: trip3.id,
    type: 'checkpoint',
    latitude: startLat3,
    longitude: startLng3,
    timestamp: trip3.startTime,
    note: 'Shelter Point — Rock overhang',
    mediaUri: null,
  });
}
