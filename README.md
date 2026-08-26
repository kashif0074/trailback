# Trailback 🌲🧭

> **100% Offline Turn-by-Turn Trail & Expedition Navigation System for Expo & React Native**

Trailback is an offline-first expedition companion built for hikers, mountaineers, and outdoor adventurers. As you travel, the app continuously records high-precision GPS breadcrumb vectors and waypoints into local SQLite. When returning, the engine automatically reverses your outbound path and provides **Google Maps-style turn-by-turn navigation, live vector trail maps, off-trail deviation alerts, and spoken voice guidance**—completely offline without cellular data or internet connection.

---

## ✨ Features

- **🚶‍♂️ Real-time Expedition Tracking**: Continuous recording with high/medium/low GPS accuracy classification, dynamic pace (`min/km` or `min/mi`), live elapsed timer, and odometer accumulation.
- **🔄 100% Offline Turn-by-Turn Return Navigation**:
  - **Maneuver Detection**: Automatically extracts left/right turns, sharp bends, forks, and waypoints from recorded GPS points.
  - **Google Maps-Style Direction Banner**: Turn arrow icons, distance countdown meters (`120 m`, `40 m`, `Turn now!`), and upcoming maneuver guidance.
  - **Spoken Voice Prompts (`expo-speech`)**: Offline text-to-speech directions for hands-free navigation.
  - **Off-Trail Deviation Alerting**: Automatically alerts when wandering $>25\text{m}$ off the path with corrective compass bearing to rejoin.
- **🗺️ Interactive Vector Trail Maps**: Native SVG route map rendering with directional return chevrons and real-time user puck with heading indicator.
- **📍 Rich Marker & Waypoint Capture**:
  - Photo Landmarks (Camera snapshot or Photo Library).
  - Voice Breadcrumbs with live stopwatch recording via `expo-audio`.
  - Safety Checkpoints with custom notes.
- **📤 GPX 1.1 Route Export**: Export and share standard GPX routes with other hiking apps and GPS devices.
- **🚨 Emergency Response System**: Direct 1-tap dial buttons for **Rescue 1122** and **Emergency 112**, plus simulated Bluetooth distress beacon.
- **💾 Offline Map Pack Manager**: Cache and manage offline vector topographic regions.

---

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 57](https://expo.dev) / React Native 0.86.2
- **Routing**: [Expo Router v57](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Database**: `expo-sqlite` (Local SQLite database)
- **Audio Engine**: `expo-audio`
- **Voice Guidance**: `expo-speech`
- **Sensors & Location**: `expo-location`, `expo-sensors` (Magnetometer + GPS Sensor Fusion)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Vector Graphics**: `react-native-svg`
- **Icons**: `lucide-react-native`

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Start Development Server
```bash
npx expo start
```

- Press `a` for Android Emulator
- Press `i` for iOS Simulator
- Scan QR code with Expo Go or run on Development Build

---

## 📱 Navigation Workflow

1. **Start Trip**: Tap **"Start New Trip"** on Dashboard to begin recording GPS breadcrumbs.
2. **Mark POIs**: Tap **`+`** to record Photo Landmarks, Voice Breadcrumbs, or Safety Checkpoints.
3. **Return Navigation**: Tap **"Take Me Back"** or **"Re-walk Route"** to engage the reverse turn-by-turn guidance engine.
4. **Follow Directions**: Receive real-time distance countdowns, turn arrows, voice prompts, and vector trail tracking all the way back to the trailhead.

---

## 📄 License
MIT License. Built for off-grid outdoor explorers.
