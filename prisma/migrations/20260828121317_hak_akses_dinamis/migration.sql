-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermissionGrant_subjectType_subject_idx" ON "PermissionGrant"("subjectType", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_subjectType_subject_permission_key" ON "PermissionGrant"("subjectType", "subject", "permission");
