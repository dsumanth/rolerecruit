// Silence noisy native module warnings during component tests.
// Use virtual mocks so these work even before the packages are installed
// (some packages land in later tasks). Once installed, jest still uses these
// mock implementations.
jest.mock(
  "expo-secure-store",
  () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true },
);

jest.mock(
  "expo-notifications",
  () => ({
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExpoTestToken[xxx]" }),
    setNotificationHandler: jest.fn(),
    AndroidImportance: { DEFAULT: 3 },
    setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true },
);

jest.mock(
  "expo-device",
  () => ({
    isDevice: true,
  }),
  { virtual: true },
);

// react-native-screens reaches into codegenNativeComponent which isn't
// exposed by jest-expo's react-native mock. Stub the surface we use so
// @react-navigation/native-stack can mount in tests.
jest.mock("expo-speech-recognition", () => {
  const React = require("react");
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    ExpoSpeechRecognitionModule: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      start: jest.fn(),
      stop: jest.fn(),
    },
    useSpeechRecognitionEvent: (name: string, cb: (e: any) => void) => {
      React.useEffect(() => {
        if (!listeners[name]) listeners[name] = [];
        listeners[name].push(cb);
        return () => {
          listeners[name] = (listeners[name] ?? []).filter((l) => l !== cb);
        };
      }, [name, cb]);
    },
    __emit: (name: string, e: any) => (listeners[name] ?? []).forEach((cb) => cb(e)),
    __reset: () => {
      for (const k of Object.keys(listeners)) delete listeners[k];
    },
  };
});

jest.mock(
  "react-native-screens",
  () => {
    const RN = require("react-native");
    const passthrough = ({ children }: { children?: unknown }) => children ?? null;
    return {
      __esModule: true,
      enableScreens: jest.fn(),
      enableFreeze: jest.fn(),
      compatibilityFlags: {},
      Screen: RN.View,
      ScreenContainer: RN.View,
      ScreenStack: RN.View,
      ScreenStackItem: RN.View,
      ScreenStackHeaderConfig: passthrough,
      ScreenStackHeaderSubview: passthrough,
      ScreenStackHeaderLeftView: passthrough,
      ScreenStackHeaderRightView: passthrough,
      ScreenStackHeaderCenterView: passthrough,
      ScreenStackHeaderBackButtonImage: passthrough,
      ScreenStackHeaderSearchBarView: passthrough,
      SearchBar: RN.View,
      FullWindowOverlay: RN.View,
      NativeScreen: RN.View,
      NativeScreenContainer: RN.View,
      NativeScreenNavigationContainer: RN.View,
      shouldUseActivityState: true,
      screensEnabled: () => true,
      isSearchBarAvailableForCurrentPlatform: false,
    };
  },
  { virtual: true },
);
