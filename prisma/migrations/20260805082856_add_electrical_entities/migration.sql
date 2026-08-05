-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "heightMm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT,
    "deviceId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "powerW" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 230,
    "count" INTEGER NOT NULL DEFAULT 1,
    "demandRatio" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "roomName" TEXT,
    "circuitId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'L1',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circuit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "boardId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ratedCurrentA" DOUBLE PRECISION,
    "breakerType" TEXT,
    "cableType" TEXT,
    "crossSectionMm2" DOUBLE PRECISION,
    "lengthM" DOUBLE PRECISION,
    "phase" TEXT NOT NULL DEFAULT 'L1',
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionBoard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Щит',
    "inBreakerA" DOUBLE PRECISION,
    "inBreakerType" TEXT,
    "rcdIn" BOOLEAN NOT NULL DEFAULT false,
    "rcdInMA" DOUBLE PRECISION,
    "rcdInType" TEXT,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 230,
    "phases" TEXT NOT NULL DEFAULT 'single',
    "dinModules" INTEGER NOT NULL DEFAULT 0,
    "enclosureType" TEXT NOT NULL DEFAULT 'surface',
    "manufacturer" TEXT,
    "article" TEXT,
    "priceLevel" TEXT NOT NULL DEFAULT 'standard',
    "properties" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "DistributionBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "circuitId" TEXT,
    "fromDeviceId" TEXT,
    "toDeviceId" TEXT,
    "cableType" TEXT NOT NULL DEFAULT 'power',
    "crossSectionMm2" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "routeM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spareM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "segments" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,

    CONSTRAINT "CableRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceBudget" INTEGER NOT NULL DEFAULT 0,
    "priceStandard" INTEGER NOT NULL DEFAULT 0,
    "pricePremium" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "vendor" TEXT,
    "sku" TEXT,
    "article" TEXT,
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isHiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceWorkItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceBudget" INTEGER NOT NULL DEFAULT 0,
    "priceStandard" INTEGER NOT NULL DEFAULT 0,
    "pricePremium" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isHiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Смета',
    "priceLevel" TEXT NOT NULL DEFAULT 'standard',
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMaterial" INTEGER NOT NULL DEFAULT 0,
    "totalWork" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publicSlug" TEXT,
    "publicExpiresAt" TIMESTAMP(3),
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateItem" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "priceItemId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "estimateId" TEXT,
    "number" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'wirenboard',
    "name" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "devices" JSONB NOT NULL DEFAULT '[]',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consumer_projectId_idx" ON "Consumer"("projectId");

-- CreateIndex
CREATE INDEX "Consumer_roomId_idx" ON "Consumer"("roomId");

-- CreateIndex
CREATE INDEX "Consumer_circuitId_idx" ON "Consumer"("circuitId");

-- CreateIndex
CREATE INDEX "Circuit_projectId_idx" ON "Circuit"("projectId");

-- CreateIndex
CREATE INDEX "Circuit_boardId_idx" ON "Circuit"("boardId");

-- CreateIndex
CREATE INDEX "DistributionBoard_projectId_idx" ON "DistributionBoard"("projectId");

-- CreateIndex
CREATE INDEX "CableRun_projectId_idx" ON "CableRun"("projectId");

-- CreateIndex
CREATE INDEX "CableRun_circuitId_idx" ON "CableRun"("circuitId");

-- CreateIndex
CREATE INDEX "PriceItem_userId_idx" ON "PriceItem"("userId");

-- CreateIndex
CREATE INDEX "PriceItem_category_idx" ON "PriceItem"("category");

-- CreateIndex
CREATE INDEX "PriceItem_isBuiltin_idx" ON "PriceItem"("isBuiltin");

-- CreateIndex
CREATE INDEX "PriceWorkItem_userId_idx" ON "PriceWorkItem"("userId");

-- CreateIndex
CREATE INDEX "PriceWorkItem_category_idx" ON "PriceWorkItem"("category");

-- CreateIndex
CREATE INDEX "PriceWorkItem_isBuiltin_idx" ON "PriceWorkItem"("isBuiltin");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_publicSlug_key" ON "Estimate"("publicSlug");

-- CreateIndex
CREATE INDEX "Estimate_projectId_idx" ON "Estimate"("projectId");

-- CreateIndex
CREATE INDEX "Estimate_publicSlug_idx" ON "Estimate"("publicSlug");

-- CreateIndex
CREATE INDEX "EstimateItem_estimateId_idx" ON "EstimateItem"("estimateId");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_estimateId_idx" ON "Invoice"("estimateId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "AutomationConfig_projectId_idx" ON "AutomationConfig"("projectId");

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "DistributionBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionBoard" ADD CONSTRAINT "DistributionBoard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableRun" ADD CONSTRAINT "CableRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationConfig" ADD CONSTRAINT "AutomationConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
