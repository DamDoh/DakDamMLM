-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('Pending', 'Paid', 'Failed');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('direct', 'genealogy', 'promotion');

-- CreateEnum
CREATE TYPE "CommissionAction" AS ENUM ('created', 'updated', 'paid', 'failed', 'disputed', 'resolved');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'investigating', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer', 'paypal', 'crypto', 'check', 'wire_transfer');

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'Pending',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "referralDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReferralStatus" NOT NULL DEFAULT 'active',
    "commissionEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "source" "ReferralSource" NOT NULL DEFAULT 'direct',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSalesVolume" DOUBLE PRECISION NOT NULL,
    "maxSalesVolume" DOUBLE PRECISION,
    "directCommissionRate" DOUBLE PRECISION NOT NULL,
    "residualCommissionRates" JSONB NOT NULL,
    "bonuses" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_commission_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalCommissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentTierId" TEXT,
    "personalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "directReferrals" INTEGER NOT NULL DEFAULT 0,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "lastCommissionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_commission_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commissionId" TEXT,
    "action" "CommissionAction" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_disputes" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT NOT NULL,
    "memberId" TEXT,
    "rank" TEXT NOT NULL DEFAULT 'Member',
    "sponsorId" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "processedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_userId_orderId_key" ON "commissions"("userId", "orderId");

-- CreateIndex
CREATE INDEX "commissions_userId_idx" ON "commissions"("userId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_date_idx" ON "commissions"("date");

-- CreateIndex
CREATE INDEX "commissions_type_idx" ON "commissions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerId_referredId_key" ON "referrals"("referrerId", "referredId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_referredId_idx" ON "referrals"("referredId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "referrals_level_idx" ON "referrals"("level");

-- CreateIndex
CREATE UNIQUE INDEX "commission_tiers_name_key" ON "commission_tiers"("name");

-- CreateIndex
CREATE INDEX "commission_tiers_minSalesVolume_idx" ON "commission_tiers"("minSalesVolume");

-- CreateIndex
CREATE INDEX "commission_tiers_isActive_idx" ON "commission_tiers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_commission_stats_userId_key" ON "user_commission_stats"("userId");

-- CreateIndex
CREATE INDEX "user_commission_stats_userId_idx" ON "user_commission_stats"("userId");

-- CreateIndex
CREATE INDEX "user_commission_stats_currentTierId_idx" ON "user_commission_stats"("currentTierId");

-- CreateIndex
CREATE INDEX "commission_audit_logs_userId_idx" ON "commission_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "commission_audit_logs_commissionId_idx" ON "commission_audit_logs"("commissionId");

-- CreateIndex
CREATE INDEX "commission_audit_logs_action_idx" ON "commission_audit_logs"("action");

-- CreateIndex
CREATE INDEX "commission_audit_logs_createdAt_idx" ON "commission_audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "commission_disputes_commissionId_key" ON "commission_disputes"("commissionId");

-- CreateIndex
CREATE INDEX "commission_disputes_userId_idx" ON "commission_disputes"("userId");

-- CreateIndex
CREATE INDEX "commission_disputes_commissionId_idx" ON "commission_disputes"("commissionId");

-- CreateIndex
CREATE INDEX "commission_disputes_status_idx" ON "commission_disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_memberId_key" ON "users"("memberId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_memberId_idx" ON "users"("memberId");

-- CreateIndex
CREATE INDEX "users_sponsorId_idx" ON "users"("sponsorId");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE INDEX "commission_payments_userId_idx" ON "commission_payments"("userId");

-- CreateIndex
CREATE INDEX "commission_payments_paymentDate_idx" ON "commission_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "commission_payments_status_idx" ON "commission_payments"("status");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_commission_stats" ADD CONSTRAINT "user_commission_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_commission_stats" ADD CONSTRAINT "user_commission_stats_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "commission_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_audit_logs" ADD CONSTRAINT "commission_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_audit_logs" ADD CONSTRAINT "commission_audit_logs_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_disputes" ADD CONSTRAINT "commission_disputes_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_disputes" ADD CONSTRAINT "commission_disputes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;