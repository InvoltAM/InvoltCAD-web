-- AlterTable
ALTER TABLE "ProjectTemplate" ADD COLUMN     "templateType" TEXT NOT NULL DEFAULT 'project';

-- CreateIndex
CREATE INDEX "ProjectTemplate_templateType_idx" ON "ProjectTemplate"("templateType");
