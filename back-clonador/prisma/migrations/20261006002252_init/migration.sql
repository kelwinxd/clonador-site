-- CreateTable
CREATE TABLE "Clone" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "mode" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "fileName" TEXT,
    "assets" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "linksReplaced" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clone_createdAt_idx" ON "Clone"("createdAt");
