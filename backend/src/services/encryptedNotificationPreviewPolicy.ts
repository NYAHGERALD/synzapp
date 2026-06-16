export function pickNotificationPreviewsForRecipientDevices<T>(
  notificationPreviewByDevice: Record<string, T> | undefined,
  recipientDeviceIds: string[]
): Record<string, T> {
  if (!notificationPreviewByDevice) {
    return {};
  }

  const allowedDeviceIds = new Set(recipientDeviceIds);

  return Object.fromEntries(
    Object.entries(notificationPreviewByDevice)
      .filter(([deviceId]) => allowedDeviceIds.has(deviceId))
  );
}
