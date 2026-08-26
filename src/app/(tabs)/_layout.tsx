import { Tabs } from 'expo-router';
import { Compass, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#3BE266',
      tabBarInactiveTintColor: '#82978A',
      tabBarStyle: {
        backgroundColor: '#060A08',
        borderTopColor: '#1A2C22',
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarLabelStyle: {
        fontFamily: 'Outfit_600SemiBold',
        fontSize: 11,
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Expeditions',
          tabBarIcon: ({ color }) => <Compass color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

