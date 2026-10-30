import { Alert } from 'react-native';

/** iOS-style destructive confirm before taking a saved route out of My Trips (Q-043). */
export function confirmRemove(name: string, remove: () => void) {
  Alert.alert(`Remove ${name}?`, 'It comes off My Trips on this phone. You can save it again from Search.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: remove },
  ]);
}
