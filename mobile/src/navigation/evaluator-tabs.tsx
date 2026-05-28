import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { InboxScreen } from "@/screens/inbox";
import { CalendarScreen } from "@/screens/calendar";
import { ProfileScreen } from "@/screens/profile";
import { colors } from "@/theme";

export type EvaluatorTabsParamList = {
  Inbox: undefined;
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<EvaluatorTabsParamList>();

export function EvaluatorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: { borderTopColor: colors.hairline },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Inbox: "mail-outline",
            Calendar: "calendar-outline",
            Profile: "person-outline",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
