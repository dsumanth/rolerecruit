import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { DemoDetailScreen } from "@/screens/demo-detail";
import { EvaluationFormScreen } from "@/screens/evaluation-form";
import { useSession } from "@/hooks/use-session";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
  DemoDetail: { demoId: string; inviteId: string };
  EvaluationForm: { demoId: string; inviteId: string };
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
          <>
            <Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
            <Stack.Screen
              name="DemoDetail"
              component={DemoDetailScreen}
              options={{ headerShown: true, title: "Demo" }}
            />
            <Stack.Screen
              name="EvaluationForm"
              component={EvaluationFormScreen}
              options={{ headerShown: true, title: "Evaluate" }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
