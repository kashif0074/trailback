import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Breadcrumb, Marker } from '../db/schema';
import { calculateHaversineDistance, calculateBearing, getCompassDirection } from '../utils/geoUtils';

export type ManeuverType = 
  | 'depart'
  | 'straight'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'u_turn'
  | 'pass_landmark'
  | 'pass_checkpoint'
  | 'arrival';

export interface Maneuver {
  id: string;
  type: ManeuverType;
  title: string;
  instruction: string;
  shortInstruction: string;
  latitude: number;
  longitude: number;
  routePointIndex: number;
  distanceFromPrevious: number; // in meters
  distanceToDestination: number; // in meters
  bearing: number;
  targetName?: string;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  heading?: number | null;
  timestamp: number;
}

export interface NavigationEvaluation {
  closestPointIndex: number;
  closestLatitude: number;
  closestLongitude: number;
  crossTrackDistance: number; // in meters
  isOffRoute: boolean;
  rejoinBearing: number;
  activeManeuverIndex: number;
  currentManeuver: Maneuver;
  nextUpcomingManeuver: Maneuver | null;
  distanceToManeuver: number; // in meters
  totalRemainingDistance: number; // in meters
  estimatedRemainingSeconds: number;
  progressPercent: number;
  primaryBannerText: string;
  secondaryBannerText: string;
  instructionDistanceText: string;
}

/**
 * Reverses the recorded outbound breadcrumbs to create the return route.
 */
export function buildReverseRoute(breadcrumbs: Breadcrumb[]): RoutePoint[] {
  if (!breadcrumbs || breadcrumbs.length === 0) return [];
  
  // Clone and reverse order
  const reversed = [...breadcrumbs].reverse().map(b => ({
    latitude: b.latitude,
    longitude: b.longitude,
    heading: b.heading,
    timestamp: b.timestamp,
  }));

  return reversed;
}

/**
 * Filter out closely spaced redundant points (under 5m) to avoid GPS jitter.
 */
function smoothRoutePoints(points: RoutePoint[], minDistanceMeters = 5): RoutePoint[] {
  if (points.length <= 2) return points;

  const smoothed: RoutePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = smoothed[smoothed.length - 1];
    const curr = points[i];
    const dist = calculateHaversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist >= minDistanceMeters || i === points.length - 1) {
      smoothed.push(curr);
    }
  }
  return smoothed;
}

/**
 * Extracts turn maneuvers, straight segments, and landmark checkpoints from the reverse route.
 */
export function generateManeuvers(
  rawPoints: RoutePoint[], 
  markers: Marker[] = [],
  destinationName = 'Trailhead / Starting Point'
): { maneuvers: Maneuver[]; routePoints: RoutePoint[] } {
  if (rawPoints.length === 0) {
    return { maneuvers: [], routePoints: [] };
  }

  const routePoints = smoothRoutePoints(rawPoints, 6);
  const n = routePoints.length;

  if (n === 1) {
    const singleManeuver: Maneuver = {
      id: 'm-0',
      type: 'arrival',
      title: 'Arrive at Destination',
      instruction: `Arrive at ${destinationName}`,
      shortInstruction: 'Arrive',
      latitude: routePoints[0].latitude,
      longitude: routePoints[0].longitude,
      routePointIndex: 0,
      distanceFromPrevious: 0,
      distanceToDestination: 0,
      bearing: 0,
      targetName: destinationName,
    };
    return { maneuvers: [singleManeuver], routePoints };
  }

  // Compute cumulative distances along the route
  const cumulativeDistances: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dist = calculateHaversineDistance(
      routePoints[i - 1].latitude,
      routePoints[i - 1].longitude,
      routePoints[i].latitude,
      routePoints[i].longitude
    );
    cumulativeDistances[i] = cumulativeDistances[i - 1] + dist;
  }
  const totalRouteDistance = cumulativeDistances[n - 1];

  const maneuvers: Maneuver[] = [];

  // Initial departure maneuver
  const initialBearing = calculateBearing(
    routePoints[0].latitude,
    routePoints[0].longitude,
    routePoints[1].latitude,
    routePoints[1].longitude
  );

  maneuvers.push({
    id: 'm-start',
    type: 'depart',
    title: 'Head back along trail',
    instruction: `Head ${getCompassDirection(initialBearing)} along recorded path`,
    shortInstruction: 'Start Return',
    latitude: routePoints[0].latitude,
    longitude: routePoints[0].longitude,
    routePointIndex: 0,
    distanceFromPrevious: 0,
    distanceToDestination: totalRouteDistance,
    bearing: initialBearing,
  });

  // Analyze angle changes between consecutive segments
  let lastManeuverIndex = 0;

  for (let i = 1; i < n - 1; i++) {
    const prev = routePoints[i - 1];
    const curr = routePoints[i];
    const next = routePoints[i + 1];

    const bearingIn = calculateBearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const bearingOut = calculateBearing(curr.latitude, curr.longitude, next.latitude, next.longitude);

    let angleDelta = ((bearingOut - bearingIn + 540) % 360) - 180;

    let type: ManeuverType | null = null;
    let title = '';
    let instruction = '';
    let shortInstruction = '';

    if (angleDelta > 120 || angleDelta < -120) {
      type = 'u_turn';
      title = 'Sharp U-Turn';
      instruction = 'Make a sharp U-turn back onto trail';
      shortInstruction = 'Make U-Turn';
    } else if (angleDelta >= 65) {
      type = 'sharp_right';
      title = 'Sharp Right';
      instruction = 'Take a sharp right turn on trail';
      shortInstruction = 'Sharp Right';
    } else if (angleDelta >= 35) {
      type = 'right';
      title = 'Turn Right';
      instruction = 'Turn right along trail path';
      shortInstruction = 'Turn Right';
    } else if (angleDelta >= 20) {
      type = 'slight_right';
      title = 'Bear Right';
      instruction = 'Bear slightly right along path';
      shortInstruction = 'Bear Right';
    } else if (angleDelta <= -65) {
      type = 'sharp_left';
      title = 'Sharp Left';
      instruction = 'Take a sharp left turn on trail';
      shortInstruction = 'Sharp Left';
    } else if (angleDelta <= -35) {
      type = 'left';
      title = 'Turn Left';
      instruction = 'Turn left along trail path';
      shortInstruction = 'Turn Left';
    } else if (angleDelta <= -20) {
      type = 'slight_left';
      title = 'Bear Left';
      instruction = 'Bear slightly left along path';
      shortInstruction = 'Bear Left';
    }

    // Check if close to a recorded marker/landmark
    const nearbyMarker = markers.find(m => {
      const distToPoint = calculateHaversineDistance(curr.latitude, curr.longitude, m.latitude, m.longitude);
      return distToPoint < 20;
    });

    if (nearbyMarker && !type) {
      type = nearbyMarker.type === 'checkpoint' ? 'pass_checkpoint' : 'pass_landmark';
      title = nearbyMarker.note ? `Pass ${nearbyMarker.note}` : 'Pass Landmark';
      instruction = `Continue past ${nearbyMarker.note || 'Waypoint Marker'}`;
      shortInstruction = nearbyMarker.note ? `Pass ${nearbyMarker.note}` : 'Pass Landmark';
    }

    // If a significant maneuver was detected and isn't too close to previous maneuver (at least 20m)
    if (type) {
      const distFromLast = cumulativeDistances[i] - cumulativeDistances[lastManeuverIndex];
      if (distFromLast >= 20 || maneuvers.length === 1) {
        maneuvers.push({
          id: `m-${i}`,
          type,
          title,
          instruction,
          shortInstruction,
          latitude: curr.latitude,
          longitude: curr.longitude,
          routePointIndex: i,
          distanceFromPrevious: distFromLast,
          distanceToDestination: Math.max(0, totalRouteDistance - cumulativeDistances[i]),
          bearing: bearingOut,
          targetName: nearbyMarker?.note || undefined,
        });
        lastManeuverIndex = i;
      }
    }
  }

  // Final destination arrival maneuver
  const lastIndex = n - 1;
  const distFromPrev = cumulativeDistances[lastIndex] - cumulativeDistances[lastManeuverIndex];
  maneuvers.push({
    id: 'm-arrival',
    type: 'arrival',
    title: 'Arrive at Destination',
    instruction: `Arrive at ${destinationName}`,
    shortInstruction: 'Arrive at Destination',
    latitude: routePoints[lastIndex].latitude,
    longitude: routePoints[lastIndex].longitude,
    routePointIndex: lastIndex,
    distanceFromPrevious: distFromPrev,
    distanceToDestination: 0,
    bearing: maneuvers[maneuvers.length - 1].bearing,
    targetName: destinationName,
  });

  return { maneuvers, routePoints };
}

/**
 * Calculates perpendicular cross-track error to find the closest segment on the trail.
 */
export function findClosestPointOnRoute(
  userLat: number, 
  userLng: number, 
  routePoints: RoutePoint[]
): { closestIndex: number; distanceMeters: number; closestLat: number; closestLng: number } {
  if (routePoints.length === 0) {
    return { closestIndex: 0, distanceMeters: 0, closestLat: userLat, closestLng: userLng };
  }

  let minDistance = Infinity;
  let closestIndex = 0;
  let closestLat = routePoints[0].latitude;
  let closestLng = routePoints[0].longitude;

  for (let i = 0; i < routePoints.length; i++) {
    const p = routePoints[i];
    const dist = calculateHaversineDistance(userLat, userLng, p.latitude, p.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
      closestLat = p.latitude;
      closestLng = p.longitude;
    }
  }

  return { closestIndex, distanceMeters: minDistance, closestLat, closestLng };
}

/**
 * Evaluates real-time GPS position against the turn-by-turn route, updating countdowns, active maneuvers, and banner texts.
 */
export function evaluateNavigationProgress(
  userLat: number,
  userLng: number,
  routePoints: RoutePoint[],
  maneuvers: Maneuver[],
  currentManeuverIndex: number,
  isMiles = false,
  offRouteThresholdMeters = 30
): NavigationEvaluation {
  if (routePoints.length === 0 || maneuvers.length === 0) {
    const dummyManeuver: Maneuver = {
      id: 'empty',
      type: 'straight',
      title: 'Ready',
      instruction: 'Follow route trail',
      shortInstruction: 'Follow path',
      latitude: userLat,
      longitude: userLng,
      routePointIndex: 0,
      distanceFromPrevious: 0,
      distanceToDestination: 0,
      bearing: 0,
    };

    return {
      closestPointIndex: 0,
      closestLatitude: userLat,
      closestLongitude: userLng,
      crossTrackDistance: 0,
      isOffRoute: false,
      rejoinBearing: 0,
      activeManeuverIndex: 0,
      currentManeuver: dummyManeuver,
      nextUpcomingManeuver: null,
      distanceToManeuver: 0,
      totalRemainingDistance: 0,
      estimatedRemainingSeconds: 0,
      progressPercent: 0,
      primaryBannerText: 'Follow recorded path',
      secondaryBannerText: 'Reversing outbound route',
      instructionDistanceText: '0 m',
    };
  }

  const { closestIndex, distanceMeters: crossTrackDistance, closestLat, closestLng } = findClosestPointOnRoute(
    userLat, 
    userLng, 
    routePoints
  );

  const isOffRoute = crossTrackDistance > offRouteThresholdMeters;
  const rejoinBearing = calculateBearing(userLat, userLng, closestLat, closestLng);

  // Find the next maneuver ahead of the user's closest index
  let activeIndex = currentManeuverIndex;
  
  // Advance maneuver index if user has reached or passed current target maneuver
  while (activeIndex < maneuvers.length - 1) {
    const targetManeuver = maneuvers[activeIndex];
    const distToTarget = calculateHaversineDistance(
      userLat,
      userLng,
      targetManeuver.latitude,
      targetManeuver.longitude
    );

    // If within 15 meters of this maneuver or user's route progress index is beyond this maneuver's index
    if (distToTarget <= 15 || closestIndex > targetManeuver.routePointIndex) {
      activeIndex++;
    } else {
      break;
    }
  }

  // Ensure activeIndex is bounded
  activeIndex = Math.min(activeIndex, maneuvers.length - 1);
  const currentManeuver = maneuvers[activeIndex];
  const nextUpcomingManeuver = activeIndex < maneuvers.length - 1 ? maneuvers[activeIndex + 1] : null;

  // Calculate distance remaining along the route from closest point to target maneuver
  let distanceToManeuver = 0;
  if (closestIndex <= currentManeuver.routePointIndex) {
    for (let i = closestIndex; i < currentManeuver.routePointIndex; i++) {
      distanceToManeuver += calculateHaversineDistance(
        routePoints[i].latitude,
        routePoints[i].longitude,
        routePoints[i + 1].latitude,
        routePoints[i + 1].longitude
      );
    }
  } else {
    distanceToManeuver = calculateHaversineDistance(
      userLat,
      userLng,
      currentManeuver.latitude,
      currentManeuver.longitude
    );
  }

  // Calculate total remaining distance from closest point to route end
  let totalRemainingDistance = 0;
  for (let i = closestIndex; i < routePoints.length - 1; i++) {
    totalRemainingDistance += calculateHaversineDistance(
      routePoints[i].latitude,
      routePoints[i].longitude,
      routePoints[i + 1].latitude,
      routePoints[i + 1].longitude
    );
  }

  // Compute total initial distance to compute progress percentage
  let initialTotalDistance = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    initialTotalDistance += calculateHaversineDistance(
      routePoints[i].latitude,
      routePoints[i].longitude,
      routePoints[i + 1].latitude,
      routePoints[i + 1].longitude
    );
  }

  const progressPercent = initialTotalDistance > 0
    ? Math.min(100, Math.max(0, Math.round(((initialTotalDistance - totalRemainingDistance) / initialTotalDistance) * 100)))
    : 100;

  // Assume standard hiking pace: 4.5 km/h = 1.25 m/s
  const estimatedRemainingSeconds = Math.max(0, Math.round(totalRemainingDistance / 1.25));

  // Format distance strings
  const formatDist = (meters: number) => {
    if (isMiles) {
      const miles = meters * 0.000621371;
      return miles >= 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(meters * 3.28084)} ft`;
    }
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  };

  const instructionDistanceText = formatDist(distanceToManeuver);

  // Dynamic Google Maps-style Banner Texts
  let primaryBannerText = '';
  let secondaryBannerText = '';

  if (isOffRoute) {
    primaryBannerText = `Off Trail (${Math.round(crossTrackDistance)}m)`;
    secondaryBannerText = `Head ${getCompassDirection(rejoinBearing)} (${Math.round(rejoinBearing)}°) to rejoin recorded path`;
  } else if (currentManeuver.type === 'arrival') {
    primaryBannerText = distanceToManeuver < 20 ? 'You have arrived!' : `Arriving at ${currentManeuver.targetName || 'Destination'}`;
    secondaryBannerText = `${formatDist(totalRemainingDistance)} remaining to starting point`;
  } else if (distanceToManeuver < 20) {
    primaryBannerText = `${currentManeuver.shortInstruction} now`;
    secondaryBannerText = nextUpcomingManeuver ? `Then ${nextUpcomingManeuver.instruction.toLowerCase()}` : 'Follow trail to destination';
  } else {
    primaryBannerText = `In ${instructionDistanceText}, ${currentManeuver.shortInstruction.toLowerCase()}`;
    secondaryBannerText = nextUpcomingManeuver ? `Then in ${formatDist(currentManeuver.distanceToDestination - nextUpcomingManeuver.distanceToDestination)}, ${nextUpcomingManeuver.shortInstruction.toLowerCase()}` : 'Continue straight along path';
  }

  return {
    closestPointIndex: closestIndex,
    closestLatitude: closestLat,
    closestLongitude: closestLng,
    crossTrackDistance,
    isOffRoute,
    rejoinBearing,
    activeManeuverIndex: activeIndex,
    currentManeuver,
    nextUpcomingManeuver,
    distanceToManeuver,
    totalRemainingDistance,
    estimatedRemainingSeconds,
    progressPercent,
    primaryBannerText,
    secondaryBannerText,
    instructionDistanceText,
  };
}

/**
 * Plays an offline text-to-speech spoken prompt if enabled and not muted.
 */
let lastSpokenText = '';
let lastSpokenTime = 0;

export async function speakGuidance(text: string, muted = false): Promise<void> {
  if (muted || !text) return;

  const now = Date.now();
  if (text === lastSpokenText && now - lastSpokenTime < 12000) {
    return; // Don't repeat the exact same sentence within 12 seconds
  }

  lastSpokenText = text;
  lastSpokenTime = now;

  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
    await Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.95,
    });
  } catch (err) {
    console.warn('Speech synthesis unavailable or offline:', err);
  }
}

/**
 * Triggers tactile haptic feedback for turn alerts.
 */
export async function triggerManeuverHaptics(type: 'turn' | 'warning' | 'arrival'): Promise<void> {
  try {
    if (type === 'turn') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (type === 'arrival') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (e) {
    // Haptics not available on simulator/web
  }
}
