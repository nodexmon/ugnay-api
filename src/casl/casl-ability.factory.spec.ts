import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { CaslAbilityFactory } from './casl-ability.factory';
import { Action } from './casl.types';

const makeUser = (role: Role) => ({ sub: 'user-id', phone: '', role });

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaslAbilityFactory],
    }).compile();

    factory = module.get<CaslAbilityFactory>(CaslAbilityFactory);
  });

  describe('ADMIN', () => {
    it('can manage everything', () => {
      const ability = factory.createForUser(makeUser(Role.ADMIN));
      expect(ability.can(Action.Manage, 'all')).toBe(true);
      expect(ability.can(Action.Delete, 'ServiceCategory')).toBe(true);
      expect(ability.can(Action.Create, 'NoShowReport')).toBe(true);
    });
  });

  describe('WORKER', () => {
    it('can read and action bookings but not create them', () => {
      const ability = factory.createForUser(makeUser(Role.WORKER));
      expect(ability.can(Action.Read, 'Booking')).toBe(true);
      expect(ability.can(Action.Accept, 'Booking')).toBe(true);
      expect(ability.can(Action.Cancel, 'Booking')).toBe(true);
      expect(ability.can(Action.Create, 'Booking')).toBe(false);
      expect(ability.can(Action.Update, 'Booking')).toBe(false);
    });

    it('can create verification docs but not no-show reports', () => {
      const ability = factory.createForUser(makeUser(Role.WORKER));
      expect(ability.can(Action.Create, 'VerificationDoc')).toBe(true);
      expect(ability.can(Action.Create, 'NoShowReport')).toBe(false);
    });

    it('has read-only access to service categories and barangays', () => {
      const ability = factory.createForUser(makeUser(Role.WORKER));
      expect(ability.can(Action.Read, 'ServiceCategory')).toBe(true);
      expect(ability.can(Action.Read, 'Barangay')).toBe(true);
      expect(ability.can(Action.Create, 'ServiceCategory')).toBe(false);
    });
  });

  describe('CUSTOMER', () => {
    it('can create bookings and report no-shows', () => {
      const ability = factory.createForUser(makeUser(Role.CUSTOMER));
      expect(ability.can(Action.Create, 'Booking')).toBe(true);
      expect(ability.can(Action.ReportNoShow, 'Booking')).toBe(true);
    });

    it('cannot create verification docs', () => {
      const ability = factory.createForUser(makeUser(Role.CUSTOMER));
      expect(ability.can(Action.Create, 'VerificationDoc')).toBe(false);
    });

    it('has read-only access to service categories and barangays', () => {
      const ability = factory.createForUser(makeUser(Role.CUSTOMER));
      expect(ability.can(Action.Read, 'ServiceCategory')).toBe(true);
      expect(ability.can(Action.Read, 'Barangay')).toBe(true);
      expect(ability.can(Action.Delete, 'ServiceCategory')).toBe(false);
    });
  });
});
