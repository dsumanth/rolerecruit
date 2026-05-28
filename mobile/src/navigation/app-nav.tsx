import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { DemoDetailScreen } from "@/screens/demo-detail";
import { EvaluationFormScreen } from "@/screens/evaluation-form";
import { DeclineModal } from "@/components/demos/decline-modal";
import { useSession } from "@/hooks/use-session";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
  DemoDetail: { demoId: string; inviteId: string };
  EvaluationForm: { demoId: string; inviteId: string };
  DeclineInvite: { inviteId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function DeclineInviteScreen({ route, navigation }: any) {
  return <DeclineModal inviteId={route.params.inviteId} onClose={() => navigation.goBack()} />;
}

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
            <Stack.Screen
              name="DeclineInvite"
              component={DeclineInviteScreen}
              options={{ presentation: "modal", headerShown: true, title: "Decline invite" }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
