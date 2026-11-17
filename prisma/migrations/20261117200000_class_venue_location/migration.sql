-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "venueAccuracy" DOUBLE PRECISION,
ADD COLUMN     "venueLatitude" DOUBLE PRECISION,
ADD COLUMN     "venueLongitude" DOUBLE PRECISION,
ADD COLUMN     "venueSavedAt" TIMESTAMP(3);
