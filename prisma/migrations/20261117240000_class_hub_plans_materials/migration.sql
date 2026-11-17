-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'LINK',
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER;

-- CreateTable
CREATE TABLE "ResourceFile" (
    "resourceId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ResourceFile_pkey" PRIMARY KEY ("resourceId")
);

-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "scriptures" TEXT,
    "objectives" TEXT,
    "activities" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPlan_classId_date_idx" ON "LessonPlan"("classId", "date");

-- AddForeignKey
ALTER TABLE "ResourceFile" ADD CONSTRAINT "ResourceFile_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
