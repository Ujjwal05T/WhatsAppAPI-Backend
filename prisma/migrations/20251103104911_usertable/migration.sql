/*
  Warnings:

  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" VARCHAR(100) NOT NULL,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "account_token" VARCHAR(100) NOT NULL,
    "auth_state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_account_token_key" ON "sessions"("account_token");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_token_fkey" FOREIGN KEY ("account_token") REFERENCES "whatsapp_accounts"("account_token") ON DELETE CASCADE ON UPDATE CASCADE;
