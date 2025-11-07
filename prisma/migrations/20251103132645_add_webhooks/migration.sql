-- CreateTable
CREATE TABLE "webhooks" (
    "id" SERIAL NOT NULL,
    "account_token" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "secret" VARCHAR(100),
    "events" TEXT[] DEFAULT ARRAY['message.received']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_account_token_fkey" FOREIGN KEY ("account_token") REFERENCES "whatsapp_accounts"("account_token") ON DELETE CASCADE ON UPDATE CASCADE;
