CREATE TABLE "push_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tickets_ticketId_key" ON "push_tickets"("ticketId");
