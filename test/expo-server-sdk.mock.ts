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
}

export type ExpoPushMessage = Record<string, unknown>;
export type ExpoPushTicket = { status: 'ok' | 'error' };
