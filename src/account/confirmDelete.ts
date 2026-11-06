import { Alert } from 'react-native';

/**
 * Apple 5.1.1(v): deleting an account starts in the app. One clear warning, then it's done; no
 * email, call or web form. Resolves true when they confirmed.
 */
export function confirmDeleteAccount(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Delete your account?',
      'Your OutBound account, your email and everything you’ve shared are deleted for good, and this phone’s saved routes, logbook and settings are cleared. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete Account', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
