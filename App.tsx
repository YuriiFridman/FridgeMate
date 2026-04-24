import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { supabase } from "./src/lib/supabase";
import AuthScreen from "./src/screens/AuthScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import RecipeScreen from "./src/screens/RecipeScreen";
import EventsScreen from "./src/screens/EventsScreen";
import ShoppingScreen from "./src/screens/ShoppingScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { AppThemeProvider, useAppTheme } from "./src/theme/appTheme";

const Tab = createBottomTabNavigator();

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const { isDark, palette } = useAppTheme();

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(initialSession ?? null);
      setIsBootstrapping(false);
    };

    bootstrap().catch(() => setIsBootstrapping(false));

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession ?? null);
      },
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (isBootstrapping) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {session ? (
        <NavigationContainer
          theme={
            isDark
              ? {
                  ...DarkTheme,
                  colors: {
                    ...DarkTheme.colors,
                    background: palette.bg,
                    card: palette.card,
                    text: palette.text,
                    border: palette.border,
                    primary: palette.accent,
                  },
                }
              : {
                  ...DefaultTheme,
                  colors: {
                    ...DefaultTheme.colors,
                    background: palette.bg,
                    card: palette.card,
                    text: palette.text,
                    border: palette.border,
                    primary: palette.accent,
                  },
                }
          }
        >
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: palette.accent,
              tabBarInactiveTintColor: palette.textMuted,
              tabBarStyle: {
                borderTopColor: palette.border,
                backgroundColor: palette.card,
              },
              tabBarIcon: ({ color, size }) => {
                let iconName: keyof typeof MaterialCommunityIcons.glyphMap = "fridge-variant";
                if (route.name === "Рецепты") iconName = "chef-hat";
                if (route.name === "Посиделки") iconName = "account-group";
                if (route.name === "Покупки") iconName = "cart";
                if (route.name === "Профиль") iconName = "account-circle";
                return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Холодильник" component={InventoryScreen} />
            <Tab.Screen name="Рецепты" component={RecipeScreen} />
            <Tab.Screen name="Посиделки" component={EventsScreen} />
            <Tab.Screen name="Покупки" component={ShoppingScreen} />
            <Tab.Screen name="Профиль" component={ProfileScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      ) : (
        <AuthScreen onAuthSuccess={async () => Promise.resolve()} />
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}
