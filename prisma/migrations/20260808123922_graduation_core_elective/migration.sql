/*
  Warnings:

  - You are about to drop the column `creditsCompleted` on the `GraduationProgress` table. All the data in the column will be lost.
  - You are about to drop the column `creditsRequired` on the `GraduationProgress` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('CORE', 'ELECTIVE');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "creditType" "CreditType" NOT NULL DEFAULT 'CORE';

-- AlterTable
ALTER TABLE "GraduationProgress" DROP COLUMN "creditsCompleted",
DROP COLUMN "creditsRequired",
ADD COLUMN     "coreCreditsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coreCreditsRequired" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "electiveCreditsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "electiveCreditsRequired" INTEGER NOT NULL DEFAULT 2;
