// Tests render pieces without the app's GestureHandlerRootView, so a gesture's detector just shows
// its child here (round 134). A test that plays a gesture mocks the module itself.
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }) => children,
}));

// The phone's key-value store, in memory (round 136: the route card's one-time slide remembers it ran).
// A test that checks what was stored mocks the module itself.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
