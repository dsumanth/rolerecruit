import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { useSession } from "@/hooks/use-session";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNav() {
  const { signedIn, loading } = useSession();
  useRegisterPushToken();
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
