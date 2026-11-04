// Tests render pieces without the app's GestureHandlerRootView, so a gesture's detector just shows
// its child here (round 134). A test that plays a gesture mocks the module itself.
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }) => children,
}));
