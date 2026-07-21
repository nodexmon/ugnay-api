export class PrismaClient {
  constructor(..._args: unknown[]) {}

  $connect = jest.fn();
  $disconnect = jest.fn();
}

export class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;

  constructor(
    message: string,
    {
      code,
      clientVersion,
      meta,
    }: { code: string; clientVersion: string; meta?: object },
  ) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta as Record<string, unknown>;
  }
}

export const Prisma = { PrismaClientKnownRequestError };
