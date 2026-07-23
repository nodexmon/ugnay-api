export default class Expo {
  static isExpoPushToken(_token: string): boolean {
    return true;
  }
  chunkPushNotifications(messages: unknown[]) {
    return [messages];
  }
  async sendPushNotificationsAsync() {
    return [];
  }
  chunkPushNotificationReceiptIds(ids: string[]) {
    return [ids];
  }
  async getPushNotificationReceiptsAsync(_ids: string[]) {
    return {} as Record<
      string,
      { status: 'ok' | 'error'; details?: { error?: string } }
    >;
  }
}

export type ExpoPushMessage = Record<string, unknown>;
export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };
export type ExpoPushReceiptId = string;
export type ExpoPushReceipt =
  | { status: 'ok' }
  | { status: 'error'; message: string; details?: { error?: string } };
