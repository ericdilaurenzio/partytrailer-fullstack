// mobile/lib/notifications.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { BACKEND_URL, OWNERS, DEFAULT_OWNER_INDEX } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

export async function registerPushToken() {
  try {
    // Skip on Expo Go (remote push not supported in SDK 53)
    if (Constants?.appOwnership === 'expo') {
      console.log('Expo Go detected: skipping remote push token registration.');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Provide a projectId for dev builds (two common places to read it from)
    const inferredProjectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      '<ADD_YOUR_EAS_PROJECT_ID_HERE>'; // replace once you make a dev build

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: inferredProjectId })).data;

    const viewerId = OWNERS[DEFAULT_OWNER_INDEX].id;
    await fetch(`${BACKEND_URL}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: viewerId, expoPushToken: token }),
    });

    return token;
  } catch (e) {
    console.log('Failed to register push token', e?.message || e);
    return null;
  }
}
