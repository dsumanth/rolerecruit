import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { HRTabs } from "@/navigation/hr-tabs";
import { DemoDetailScreen } from "@/screens/demo-detail";
import { EvaluationFormScreen } from "@/screens/evaluation-form";
import { CandidateDetailScreen } from "@/screens/candidate-detail";
import { ScheduleDemoScreen } from "@/screens/schedule-demo";
import { DemoSummaryScreen } from "@/screens/demo-summary";
import { DeclineModal } from "@/components/demos/decline-modal";
import { useSession } from "@/hooks/use-session";
import { useRoleContext } from "@/hooks/use-role-context";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
  HRTabs: undefined;
  DemoDetail: { demoId: string; inviteId: string };
  EvaluationForm: { demoId: string; inviteId: string };
  DeclineInvite: { inviteId: string };
  CandidateDetail: { candidateId: string };
  ScheduleDemo: { applicationId: string; parentDemoId?: string };
  DemoSummary: { demoId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function DeclineInviteScreen({ route, navigation }: any) {
  return <DeclineModal inviteId={route.params.inviteId} onClose={() => navigation.goBack()} />;
}

export function AppNav() {
  const { signedIn, loading: sessionLoading } = useSession();
  const role = useRoleContext();
  useRegisterPushToken();
  if (sessionLoading || (signedIn && role.loading)) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <>
            {role.isHR ? (
              <Stack.Screen name="HRTabs" component={HRTabs} />
            ) : (
              <Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
            )}
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
            <Stack.Screen
              name="CandidateDetail"
              component={CandidateDetailScreen}
              options={{ headerShown: true, title: "Candidate" }}
            />
            <Stack.Screen
              name="ScheduleDemo"
              component={ScheduleDemoScreen}
              options={{ presentation: "modal", headerShown: true, title: "Schedule demo" }}
            />
            <Stack.Screen
              name="DemoSummary"
              component={DemoSummaryScreen}
              options={{ headerShown: true, title: "Summary" }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
