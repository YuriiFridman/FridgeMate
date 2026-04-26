import { Platform } from "react-native";

export async function scheduleExpiryNotification(
  productName: string,
  expiryDate: Date,
): Promise<void> {
  if (Platform.OS === "web") return;
  const nativeService = await import("./notificationService.native");
  await nativeService.scheduleExpiryNotification(productName, expiryDate);
}
