// Local reminders (no server, no push): when the app goes to the background we schedule a few notifications
// from the shop's state, and cancel them all when it comes back. Opt-in from Menu (settings.notify).
// app.json sets the expo-notifications plugin to enableRemoteNotifications: false, so no push (aps-environment) entitlement.
// What to remind about is decided in the core (E.remindersAt, checked by tools/reminder-check.js).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { E, GameState } from './game';

Notifications.setNotificationHandler({
  // while the app is open the game shows its own banners, so stay quiet
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

export type Reminder = { id: string; seconds: number; title: string; body: string };

/** The reminder kinds the player can switch on and off (ids match E.remindersAt). */
export const REMINDER_KINDS: { id: string; label: string; hint: string }[] = [
  { id: 'night', label: 'Night shift is over', hint: 'When offline earning stops' },
  { id: 'empty', label: 'Shelves are empty', hint: 'Only if nothing restocks for you' },
  { id: 'tokens', label: 'A Franchise Token is ready', hint: 'When the shop has made enough to cash in' },
  { id: 'launch', label: 'A console launches', hint: 'Needs Console Corner' },
  { id: 'service', label: 'Service Desk is overloaded', hint: 'Jobs are being turned away' },
];
export const LEAD_CHOICES = [{ min: 0, label: 'When it ends' }, { min: 15, label: '15 min before' }, { min: 30, label: '30 min before' }, { min: 60, label: '1 h before' }];

/** What E.remindersAt needs from the player's settings. */
export const reminderOptions = (s: GameState) => ({ kinds: s.settings?.notifyKinds ?? {}, leadMin: s.settings?.notifyLead ?? 0 });

let asked: boolean | null = null;
/** Ask the OS (once per launch at most). Returns whether reminders may be shown. */
export async function enable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return (asked = true);
    if (!cur.canAskAgain) return (asked = false);
    const r = await Notifications.requestPermissionsAsync();
    return (asked = r.granted);
  } catch { return false; }
}

/** App going to the background: schedule this shop's reminders (replacing earlier ones). */
export async function scheduleFor(s: GameState) {
  if (!s || !s.settings || !s.settings.notify || Platform.OS === 'web') return;
  try {
    if (asked === null) asked = (await Notifications.getPermissionsAsync()).granted;
    if (!asked) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of E.remindersAt(s, reminderOptions(s)) as Reminder[]) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(r.seconds) },
      });
    }
  } catch { /* reminders are a nicety: never break the game over them */ }
}

/** App back in front: whatever we scheduled is moot now. */
export async function cancelAll() {
  if (Platform.OS === 'web') return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}
