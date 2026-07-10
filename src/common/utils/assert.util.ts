import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';

export async function assertUserIsActive(
  prisma: PrismaService,
  userId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenException('Active user is required.');
  }
  return user;
}

export async function assertBookingExists(
  prisma: PrismaService,
  bookingId: string,
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundException('Booking not found.');
  return booking;
}

export async function assertWorkerProfileExists(
  prisma: PrismaService,
  workerId: string,
) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
  });
  if (!worker) throw new NotFoundException('Worker profile not found.');
  return worker;
}
