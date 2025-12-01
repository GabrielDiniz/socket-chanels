-- CreateTable
CREATE TABLE `channels` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `tenant` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `channels_slug_key`(`slug`),
    UNIQUE INDEX `channels_apiKey_key`(`apiKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calls` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `patientName` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `professional` VARCHAR(191) NULL,
    `ticket` VARCHAR(191) NULL,
    `isPriority` BOOLEAN NOT NULL DEFAULT false,
    `sourceSystem` VARCHAR(191) NOT NULL,
    `rawPayload` JSON NULL,
    `calledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `calls_channelId_calledAt_idx`(`channelId`, `calledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `calls` ADD CONSTRAINT `calls_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
