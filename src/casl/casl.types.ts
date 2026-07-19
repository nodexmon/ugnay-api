import { MongoAbility } from '@casl/ability';

export enum Action {
  Manage = 'manage',

  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',

  Accept = 'accept',
  Reject = 'reject',
  Start = 'start',
  Complete = 'complete',
  Cancel = 'cancel',
  ReportNoShow = 'report-no-show',
  ReportCustomerNoShow = 'report-customer-no-show',
}

export type Subject =
  | 'WorkerProfile'
  | 'CustomerProfile'
  | 'Booking'
  | 'Review'
  | 'NoShowReport'
  | 'VerificationDoc'
  | 'WorkerCredential'
  | 'ServiceCategory'
  | 'Barangay'
  | 'User'
  | 'PushToken'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subject]>;
