import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionRequested = false;

async function ensureNotificationPermission() {
  if (permissionRequested) return;
  permissionRequested = true;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return;

  const requested = await Notifications.requestPermissionsAsync();
  if (!requested.granted) {
    throw new Error("Нет разрешения на локальные уведомления.");
  }
}

function buildTriggerDate(expiryDate: Date) {
  const triggerDate = new Date(expiryDate);
  triggerDate.setDate(triggerDate.getDate() - 1);
  triggerDate.setHours(10, 0, 0, 0);
  return triggerDate;
}

export async function scheduleExpiryNotification(productName: string, expiryDate: Date) {
  const triggerDate = buildTriggerDate(expiryDate);
  if (Number.isNaN(triggerDate.getTime()) || triggerDate <= new Date()) {
    return;
  }

  await ensureNotificationPermission();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "FridgeMate",
      body: `Внимание! ${productName} портится. Пора что-то приготовить!`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}
