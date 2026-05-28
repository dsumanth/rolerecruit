import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/app-providers";
import { AppNav } from "@/navigation/app-nav";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <AppNav />
        <StatusBar style="auto" />
      </AppProviders>
    </SafeAreaProvider>
  );
}
