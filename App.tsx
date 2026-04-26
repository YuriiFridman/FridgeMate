import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { supabase } from "./src/lib/supabase";
import { AppThemeProvider, useAppTheme } from "./src/theme/appTheme";
import { clearCachedHouseholdId, ensureCurrentUserSetup } from "./src/lib/userSetup";
import { validateRuntimeEnv } from "./src/lib/env";

const Tab = createBottomTabNavigator();
const AuthScreen = lazy(() => import("./src/screens/AuthScreen"));
const InventoryScreen = lazy(() => import("./src/screens/InventoryScreen"));
const RecipeScreen = lazy(() => import("./src/screens/RecipeScreen"));
const EventsScreen = lazy(() => import("./src/screens/EventsScreen"));
const ShoppingScreen = lazy(() => import("./src/screens/ShoppingScreen"));
const ProfileScreen = lazy(() => import("./src/screens/ProfileScreen"));

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const { isDark, palette } = useAppTheme();
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    validateRuntimeEnv();
    if (typeof document !== "undefined") {
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement("meta");
        viewport.setAttribute("name", "viewport");
        document.head.appendChild(viewport);
      }
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      );
      document.documentElement.style.width = "100%";
      document.documentElement.style.height = "100%";
      document.documentElement.style.overflowX = "hidden";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.overflowX = "hidden";
    }

    const bootstrap = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (initialSession?.user?.id) {
        // Ensure profile/household row exists for legacy auth users.
        await ensureCurrentUserSetup().catch(() => {});
      }

      if (!isMounted) return;

      setSession(initialSession ?? null);
      currentUserIdRef.current = initialSession?.user?.id ?? null;
      setIsBootstrapping(false);
    };

    bootstrap().catch(() => setIsBootstrapping(false));

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        const previousUserId = currentUserIdRef.current;
        const nextUserId = nextSession?.user?.id;
        if (previousUserId && previousUserId !== nextUserId) {
          await clearCachedHouseholdId(previousUserId);
        }
        if (nextUserId) {
          await ensureCurrentUserSetup().catch(() => {});
        }
        currentUserIdRef.current = nextUserId ?? null;
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
          <Suspense fallback={null}>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: palette.accent,
                tabBarInactiveTintColor: palette.textMuted,
                tabBarStyle: {
                  borderTopColor: palette.border,
                  backgroundColor: palette.card,
                  marginBottom: 6,
                  height: 62,
                  paddingBottom: 6,
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
          </Suspense>
        </NavigationContainer>
      ) : (
        <Suspense fallback={null}>
          <AuthScreen onAuthSuccess={async () => Promise.resolve()} />
        </Suspense>
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
