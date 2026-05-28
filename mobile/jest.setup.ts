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
