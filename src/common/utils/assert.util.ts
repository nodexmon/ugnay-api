import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import type { Booking, User } from '@/generated/prisma/client';

export async function assertUserExists(
  prisma: PrismaService,
  userId: string,
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User does not exist.');
  return user;
}

export async function assertBookingExists(
  prisma: PrismaService,
  bookingId: string,
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundException('Booking not found.');
  return booking;
}
