-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "deviceId" TEXT;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "accuracy" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
