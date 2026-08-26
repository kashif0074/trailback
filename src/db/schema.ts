export type Trip = {
  id: string;
  name: string | null;
  startTime: number;
  endTime: number | null;
  totalDistance: number; // in meters
};

export type Breadcrumb = {
  id: string;
  tripId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
  heading: number | null;
};

export type MarkerType = 'landmark' | 'voice' | 'checkpoint';

export type Marker = {
  id: string;
  tripId: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  timestamp: number;
  note: string | null;
  mediaUri: string | null; // path to photo or audio file
};

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  startTime INTEGER NOT NULL,
  endTime INTEGER,
  totalDistance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS breadcrumbs (
  id TEXT PRIMARY KEY NOT NULL,
  tripId TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  accuracy REAL,
  heading REAL,
  FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS markers (
  id TEXT PRIMARY KEY NOT NULL,
  tripId TEXT NOT NULL,
  type TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  note TEXT,
  mediaUri TEXT,
  FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_tripId ON breadcrumbs(tripId);
CREATE INDEX IF NOT EXISTS idx_markers_tripId ON markers(tripId);
`;
