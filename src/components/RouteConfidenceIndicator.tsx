import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTripStore } from '../store/useTripStore';

export function RouteConfidenceIndicator() {
  const confidence = useTripStore((state) => state.confidence);

  let color = '#3BE266'; // high
  let text = 'GPS + COMPASS';
  let bars = 3;

  if (confidence === 'medium') {
    color = '#F5A623';
    text = 'GPS LOCK';
    bars = 2;
  } else if (confidence === 'low') {
    color = '#E53935';
    text = 'SENSOR ESTIMATING';
    bars = 1;
  }

  return (
    <View style={[styles.container, { borderColor: color }]}>
      <View style={styles.barsContainer}>
        <View style={[styles.bar, { backgroundColor: bars >= 1 ? color : '#1A2C22' }]} />
        <View style={[styles.bar, { backgroundColor: bars >= 2 ? color : '#1A2C22' }]} />
        <View style={[styles.bar, { backgroundColor: bars >= 3 ? color : '#1A2C22' }]} />
      </View>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1A14',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 12,
    marginRight: 8,
  },
  bar: {
    width: 4,
    height: 8,
    marginLeft: 2,
    borderRadius: 2,
  },
  text: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
  }
});

