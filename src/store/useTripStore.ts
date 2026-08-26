import { create } from 'zustand';
import { Breadcrumb, Marker, Trip } from '../db/schema';
import * as Crypto from 'expo-crypto';
import { createTrip, finishTrip, updateTripDistance } from '../db/database';
import {
  Maneuver,
  RoutePoint,
  NavigationEvaluation,
  buildReverseRoute,
  generateManeuvers,
  evaluateNavigationProgress,
  speakGuidance,
  triggerManeuverHaptics,
} from '../services/turnByTurnEngine';
import {
  calculateHaversineDistance,
  calculateBearing,
  getCompassDirection,
} from '../utils/geoUtils';

export {
  calculateHaversineDistance,
  calculateBearing,
  getCompassDirection,
};

export type TrackingStatus = 'idle' | 'recording' | 'paused' | 'returning';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DistanceUnit = 'km' | 'mi';
export type SamplingMode = 'adaptive' | 'high' | 'low';

interface TripState {
  status: TrackingStatus;
  currentTrip: Trip | null;
  currentBreadcrumbs: Breadcrumb[];
  currentMarkers: Marker[];
  confidence: ConfidenceLevel;

  // Turn-by-Turn Navigation State
  reverseRoutePoints: RoutePoint[];
  activeManeuvers: Maneuver[];
  activeManeuverIndex: number;
  navEvaluation: NavigationEvaluation | null;
  voiceGuidanceEnabled: boolean;
  voiceMuted: boolean;
  offRouteSensitivityMeters: number;

  // Settings
  distanceUnit: DistanceUnit;
  samplingMode: SamplingMode;
  bgTracking: boolean;
  campMode: boolean;
  autoStart: boolean;
  preTripShare: boolean;

  // Actions
  startNewTrip: () => Promise<void>;
  pauseTrip: () => void;
  resumeTrip: () => void;
  togglePauseResume: () => void;
  endTrip: () => Promise<void>;
  startReturn: () => void;
  startReturnWithTrip: (trip: Trip, breadcrumbs: Breadcrumb[], markers: Marker[]) => void;
  initTurnByTurn: (breadcrumbs?: Breadcrumb[], markers?: Marker[]) => void;
  updateNavigationLocation: (lat: number, lng: number, heading?: number | null) => void;
  setConfidence: (level: ConfidenceLevel) => void;
  addLiveBreadcrumb: (b: Breadcrumb) => void;
  addLiveMarker: (m: Marker) => void;
  
  // Settings & Navigation Actions
  setDistanceUnit: (unit: DistanceUnit) => void;
  setSamplingMode: (mode: SamplingMode) => void;
  setBgTracking: (enabled: boolean) => void;
  setCampMode: (enabled: boolean) => void;
  setAutoStart: (enabled: boolean) => void;
  setPreTripShare: (enabled: boolean) => void;
  toggleVoiceMute: () => void;
  setVoiceGuidanceEnabled: (enabled: boolean) => void;
  setOffRouteSensitivity: (meters: number) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  status: 'idle',
  currentTrip: null,
  currentBreadcrumbs: [],
  currentMarkers: [],
  confidence: 'high',

  // Turn-by-turn Navigation Defaults
  reverseRoutePoints: [],
  activeManeuvers: [],
  activeManeuverIndex: 0,
  navEvaluation: null,
  voiceGuidanceEnabled: true,
  voiceMuted: false,
  offRouteSensitivityMeters: 30,

  // Settings defaults
  distanceUnit: 'km',
  samplingMode: 'adaptive',
  bgTracking: true,
  campMode: false,
  autoStart: false,
  preTripShare: true,

  startNewTrip: async () => {
    const id = Crypto.randomUUID();
    const newTrip: Trip = {
      id,
      name: `Trail Expedition — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      startTime: Date.now(),
      endTime: null,
      totalDistance: 0,
    };

    await createTrip(newTrip);

    set({
      status: 'recording',
      currentTrip: newTrip,
      currentBreadcrumbs: [],
      currentMarkers: [],
      reverseRoutePoints: [],
      activeManeuvers: [],
      activeManeuverIndex: 0,
      navEvaluation: null,
      confidence: 'high',
    });
  },

  pauseTrip: () => {
    set({ status: 'paused' });
  },

  resumeTrip: () => {
    set({ status: 'recording' });
  },

  togglePauseResume: () => {
    const { status } = get();
    if (status === 'recording') {
      set({ status: 'paused' });
    } else if (status === 'paused') {
      set({ status: 'recording' });
    }
  },

  endTrip: async () => {
    const { currentTrip } = get();
    if (currentTrip) {
      await finishTrip(currentTrip.id, Date.now());
    }
    set({
      status: 'idle',
      currentTrip: null,
      currentBreadcrumbs: [],
      currentMarkers: [],
      reverseRoutePoints: [],
      activeManeuvers: [],
      activeManeuverIndex: 0,
      navEvaluation: null,
    });
  },

  startReturn: () => {
    const state = get();
    set({ status: 'returning' });
    state.initTurnByTurn();
  },

  startReturnWithTrip: (trip: Trip, breadcrumbs: Breadcrumb[], markers: Marker[]) => {
    set({
      status: 'returning',
      currentTrip: trip,
      currentBreadcrumbs: breadcrumbs,
      currentMarkers: markers,
    });
    get().initTurnByTurn(breadcrumbs, markers);
  },

  initTurnByTurn: (explicitBreadcrumbs?: Breadcrumb[], explicitMarkers?: Marker[]) => {
    const state = get();
    const crumbs = explicitBreadcrumbs || state.currentBreadcrumbs;
    const markers = explicitMarkers || state.currentMarkers;

    if (!crumbs || crumbs.length === 0) {
      return;
    }

    const rawReversed = buildReverseRoute(crumbs);
    const destinationName = state.currentTrip?.name ? `Start of ${state.currentTrip.name}` : 'Base Camp Trailhead';
    const { maneuvers, routePoints } = generateManeuvers(rawReversed, markers, destinationName);

    const initialLat = rawReversed[0].latitude;
    const initialLng = rawReversed[0].longitude;

    const evaluation = evaluateNavigationProgress(
      initialLat,
      initialLng,
      routePoints,
      maneuvers,
      0,
      state.distanceUnit === 'mi',
      state.offRouteSensitivityMeters
    );

    set({
      reverseRoutePoints: routePoints,
      activeManeuvers: maneuvers,
      activeManeuverIndex: 0,
      navEvaluation: evaluation,
    });

    if (state.voiceGuidanceEnabled && !state.voiceMuted && maneuvers.length > 0) {
      speakGuidance(`Starting return navigation. ${evaluation.primaryBannerText}. ${evaluation.secondaryBannerText}`, state.voiceMuted);
      triggerManeuverHaptics('turn');
    }
  },

  updateNavigationLocation: (lat: number, lng: number, heading?: number | null) => {
    const state = get();
    if (state.status !== 'returning' || state.reverseRoutePoints.length === 0) {
      return;
    }

    const evaluation = evaluateNavigationProgress(
      lat,
      lng,
      state.reverseRoutePoints,
      state.activeManeuvers,
      state.activeManeuverIndex,
      state.distanceUnit === 'mi',
      state.offRouteSensitivityMeters
    );

    // Check for voice & haptic alert triggers
    if (state.voiceGuidanceEnabled && !state.voiceMuted) {
      if (evaluation.isOffRoute) {
        speakGuidance(`Warning: You are off the trail by ${Math.round(evaluation.crossTrackDistance)} meters. Head ${getCompassDirection(evaluation.rejoinBearing)} to rejoin path.`, state.voiceMuted);
        triggerManeuverHaptics('warning');
      } else if (evaluation.currentManeuver.type === 'arrival' && evaluation.distanceToManeuver <= 20) {
        speakGuidance('You have arrived at your destination!', state.voiceMuted);
        triggerManeuverHaptics('arrival');
      } else if (evaluation.distanceToManeuver <= 20) {
        speakGuidance(`${evaluation.currentManeuver.shortInstruction} now!`, state.voiceMuted);
        triggerManeuverHaptics('turn');
      } else if (evaluation.distanceToManeuver <= 60 && evaluation.distanceToManeuver >= 40) {
        speakGuidance(`In 50 meters, ${evaluation.currentManeuver.shortInstruction}`, state.voiceMuted);
      }
    }

    set({
      activeManeuverIndex: evaluation.activeManeuverIndex,
      navEvaluation: evaluation,
    });
  },

  setConfidence: (level: ConfidenceLevel) => {
    set({ confidence: level });
  },

  addLiveBreadcrumb: (b: Breadcrumb) => {
    const state = get();
    const breadcrumbs = state.currentBreadcrumbs;
    let addedDistance = 0;

    if (breadcrumbs.length > 0) {
      const lastPoint = breadcrumbs[breadcrumbs.length - 1];
      addedDistance = calculateHaversineDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        b.latitude,
        b.longitude
      );
    }

    const currentTrip = state.currentTrip;
    const newDistance = (currentTrip?.totalDistance || 0) + addedDistance;

    if (currentTrip && addedDistance > 0) {
      updateTripDistance(currentTrip.id, newDistance);
    }

    set({
      currentBreadcrumbs: [...breadcrumbs, b],
      currentTrip: currentTrip ? { ...currentTrip, totalDistance: newDistance } : null,
    });
  },

  addLiveMarker: (m: Marker) => {
    set((state) => ({
      currentMarkers: [...state.currentMarkers, m],
    }));
  },

  setDistanceUnit: (unit: DistanceUnit) => set({ distanceUnit: unit }),
  setSamplingMode: (mode: SamplingMode) => set({ samplingMode: mode }),
  setBgTracking: (enabled: boolean) => set({ bgTracking: enabled }),
  setCampMode: (enabled: boolean) => set({ campMode: enabled }),
  setAutoStart: (enabled: boolean) => set({ autoStart: enabled }),
  setPreTripShare: (enabled: boolean) => set({ preTripShare: enabled }),
  toggleVoiceMute: () => set((state) => ({ voiceMuted: !state.voiceMuted })),
  setVoiceGuidanceEnabled: (enabled: boolean) => set({ voiceGuidanceEnabled: enabled }),
  setOffRouteSensitivity: (meters: number) => set({ offRouteSensitivityMeters: meters }),
}));

