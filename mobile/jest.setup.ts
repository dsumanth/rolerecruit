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
