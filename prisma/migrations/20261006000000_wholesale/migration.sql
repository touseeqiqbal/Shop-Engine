-- AlterTable
ALTER TABLE "products" ADD COLUMN     "price_on_request" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wholesale" JSONB;

-- CreateTable
CREATE TABLE "wholesale_inquiries" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "buyer_type" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT,
    "budget" TEXT,
    "admin_notes" TEXT,
    "source" TEXT,

    CONSTRAINT "wholesale_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wholesale_inquiries_status_idx" ON "wholesale_inquiries"("status");

-- CreateIndex
CREATE INDEX "wholesale_inquiries_created_at_idx" ON "wholesale_inquiries"("created_at");

