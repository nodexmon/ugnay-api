export class PrismaClient {
  constructor(..._args: unknown[]) {}

  $connect = jest.fn();
  $disconnect = jest.fn();
}

export const Prisma = {};
