import { Alert } from 'react-native';

/** iOS-style destructive confirm before wiping homes, location and search defaults (design round 25). */
export function confirmReset(reset: () => void) {
  Alert.alert('Reset all settings?', 'This clears your home airports, location choice and search defaults on this phone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: reset },
  ]);
}
