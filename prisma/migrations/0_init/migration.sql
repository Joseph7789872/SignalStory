-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GITHUB', 'PIPEDRIVE', 'ATTIO', 'LINEAR', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('MANUAL', 'GITHUB', 'PIPEDRIVE', 'ATTIO', 'LINEAR', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('QUEUED', 'NORMALIZING', 'SCORING', 'STORY', 'NARRATIVE', 'CHANNEL', 'EDITING', 'READY', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('LINKEDIN_FOUNDER', 'X_THREAD', 'BLOG_POST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'NEEDS_WORK');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('LINKEDIN');

-- CreateEnum
CREATE TYPE "FeedbackDecision" AS ENUM ('APPROVE', 'EDIT', 'REJECT', 'REGENERATE');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('COMPANY_DOC', 'CHANGELOG', 'CASE_STUDY', 'FOUNDER_POST', 'CALL_TRANSCRIPT', 'CUSTOMER_QUOTE', 'OTHER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendReservation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "signalId" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icp" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "positioning" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "beliefs" JSONB NOT NULL DEFAULT '[]',
    "frameworks" JSONB NOT NULL DEFAULT '[]',
    "lessons" JSONB NOT NULL DEFAULT '[]',
    "writingSamples" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT '',
    "sentenceStyle" TEXT NOT NULL DEFAULT '',
    "bannedPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vocabulary" JSONB NOT NULL DEFAULT '{}',
    "opinionatedness" TEXT NOT NULL DEFAULT '',
    "technicalDepth" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialStrategy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "pillars" JSONB NOT NULL DEFAULT '[]',
    "audiences" JSONB NOT NULL DEFAULT '[]',
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicsToAvoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "webhookToken" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "label" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "signalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "connectionId" TEXT,
    "source" "SignalSource" NOT NULL DEFAULT 'MANUAL',
    "rawInput" JSONB NOT NULL,
    "evidencePacket" JSONB,
    "status" "SignalStatus" NOT NULL DEFAULT 'QUEUED',
    "statusReason" TEXT,
    "significanceScore" INTEGER,
    "scoreDetail" JSONB,
    "storyAngles" JSONB,
    "narrativeBrief" JSONB,
    "retrievedProof" JSONB,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "body" JSONB NOT NULL,
    "antiSlopScore" INTEGER,
    "antiSlopDetail" JSONB,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "editedBody" JSONB,
    "regenCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "postedAt" TIMESTAMP(3),
    "autopublish" BOOLEAN NOT NULL DEFAULT false,
    "publishError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "signalId" TEXT,
    "orgId" TEXT,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "assetId" TEXT,
    "userId" TEXT NOT NULL,
    "decision" "FeedbackDecision" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "agent" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryDoc" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "MemoryKind" NOT NULL DEFAULT 'COMPANY_DOC',
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawText" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryChunk" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "SpendReservation_orgId_createdAt_idx" ON "SpendReservation"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SpendReservation_signalId_idx" ON "SpendReservation"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_orgId_key" ON "OrganizationProfile"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "FounderProfile_orgId_key" ON "FounderProfile"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandVoice_orgId_key" ON "BrandVoice"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialStrategy_orgId_key" ON "EditorialStrategy"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_webhookToken_key" ON "IntegrationConnection"("webhookToken");

-- CreateIndex
CREATE INDEX "IntegrationConnection_orgId_idx" ON "IntegrationConnection"("orgId");

-- CreateIndex
CREATE INDEX "IngestedEvent_connectionId_idx" ON "IngestedEvent"("connectionId");

-- CreateIndex
CREATE INDEX "IngestedEvent_createdAt_idx" ON "IngestedEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestedEvent_connectionId_externalId_key" ON "IngestedEvent"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "Signal_orgId_status_idx" ON "Signal"("orgId", "status");

-- CreateIndex
CREATE INDEX "Signal_orgId_deletedAt_idx" ON "Signal"("orgId", "deletedAt");

-- CreateIndex
CREATE INDEX "Signal_userId_idx" ON "Signal"("userId");

-- CreateIndex
CREATE INDEX "Signal_connectionId_idx" ON "Signal"("connectionId");

-- CreateIndex
CREATE INDEX "ContentAsset_signalId_idx" ON "ContentAsset"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_signalId_channel_key" ON "ContentAsset"("signalId", "channel");

-- CreateIndex
CREATE INDEX "ScheduledPost_orgId_scheduledFor_idx" ON "ScheduledPost"("orgId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledPost_assetId_idx" ON "ScheduledPost"("assetId");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_scheduledFor_idx" ON "ScheduledPost"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SocialAccount_orgId_idx" ON "SocialAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_orgId_provider_key" ON "SocialAccount"("orgId", "provider");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_signalId_idx" ON "AgentRun"("signalId");

-- CreateIndex
CREATE INDEX "AgentRun_orgId_createdAt_idx" ON "AgentRun"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_signalId_idx" ON "Feedback"("signalId");

-- CreateIndex
CREATE INDEX "PromptTemplate_orgId_agent_isActive_idx" ON "PromptTemplate"("orgId", "agent", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_orgId_agent_version_key" ON "PromptTemplate"("orgId", "agent", "version");

-- CreateIndex
CREATE INDEX "MemoryDoc_orgId_kind_idx" ON "MemoryDoc"("orgId", "kind");

-- CreateIndex
CREATE INDEX "MemoryChunk_orgId_idx" ON "MemoryChunk"("orgId");

-- CreateIndex
CREATE INDEX "MemoryChunk_docId_idx" ON "MemoryChunk"("docId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderProfile" ADD CONSTRAINT "FounderProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandVoice" ADD CONSTRAINT "BrandVoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialStrategy" ADD CONSTRAINT "EditorialStrategy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryDoc" ADD CONSTRAINT "MemoryDoc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryChunk" ADD CONSTRAINT "MemoryChunk_docId_fkey" FOREIGN KEY ("docId") REFERENCES "MemoryDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Folded from scripts/migrate-v5-pgvector.ts: Prisma does not manage vector
-- indexes. HNSW cosine index matching the `<=>` operator in
-- lib/knowledge/retrieve.ts.
CREATE INDEX IF NOT EXISTS memorychunk_embedding_hnsw
  ON "MemoryChunk" USING hnsw (embedding vector_cosine_ops);
