-- AlterTable
ALTER TABLE "barangays" ADD COLUMN     "psgcCode" TEXT,
ALTER COLUMN "centroidLat" DROP NOT NULL,
ALTER COLUMN "centroidLng" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "barangays_psgcCode_key" ON "barangays"("psgcCode");
