import { NotFoundException } from '@nestjs/common';

type HttpExceptionConstructor = new (message: string) => Error;

export async function assertExists<T>(
  finder: () => Promise<T | null>,
  errorMessage: string,
  Exception: HttpExceptionConstructor = NotFoundException,
): Promise<T> {
  const entity = await finder();
  if (!entity) throw new Exception(errorMessage);
  return entity;
}
