// Sounds don't play in tests (round 181). A test that checks a sound mocks the module itself.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ currentTime: 0, play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()) })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
