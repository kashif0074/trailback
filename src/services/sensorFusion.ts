import { Magnetometer, MagnetometerMeasurement } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

let magnetometerSubscription: Subscription | null = null;
let currentHeading = 0;
let smoothedHeading = 0;

// Helper to smooth heading changes across 0/360 boundary using circular interpolation
function smoothAngle(current: number, target: number, alpha: number = 0.25): number {
  let diff = target - current;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return (current + diff * alpha + 360) % 360;
}

export const startSensorFusion = async (onHeadingChange: (heading: number) => void) => {
  try {
    const isAvailable = await Magnetometer.isAvailableAsync();
    if (!isAvailable) {
      console.log('Magnetometer is not available on this device/environment');
      return;
    }

    Magnetometer.setUpdateInterval(100); // 100ms for smooth compass response

    magnetometerSubscription = Magnetometer.addListener((data: MagnetometerMeasurement) => {
      let rawHeading = Math.atan2(data.y, data.x) * (180 / Math.PI);
      rawHeading = rawHeading >= 0 ? rawHeading : rawHeading + 360;
      
      currentHeading = rawHeading;
      smoothedHeading = smoothAngle(smoothedHeading, rawHeading, 0.3);
      onHeadingChange(Math.round(smoothedHeading));
    });
  } catch (error) {
    console.warn('Error starting sensor fusion:', error);
  }
};

export const stopSensorFusion = () => {
  if (magnetometerSubscription) {
    magnetometerSubscription.remove();
    magnetometerSubscription = null;
  }
};

export const getCurrentHeading = () => smoothedHeading || currentHeading;

