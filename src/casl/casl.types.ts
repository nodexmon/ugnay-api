import { MongoAbility } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export type Subject =
  | 'WorkerProfile'
  | 'CustomerProfile'
  | 'Booking'
  | 'Review'
  | 'NoShowReport'
  | 'VerificationDoc'
  | 'ServiceCategory'
  | 'Barangay'
  | 'User'
  | 'PushToken'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subject]>;
