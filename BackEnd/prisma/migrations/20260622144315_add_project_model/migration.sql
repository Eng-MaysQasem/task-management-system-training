/*
  Warnings:

  - Added the required column `projectId` to the `sprints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
/*
  Warnings:

  - Added the required column `projectId` to the `sprints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/

-- Create Table
CREATE TABLE `projects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

--  Seed the default project
INSERT INTO `projects` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`) 
VALUES (1, 'General Project', true, NOW(), NOW());

-- Add the columns with a temporary default
ALTER TABLE `sprints` ADD COLUMN `projectId` BIGINT NOT NULL DEFAULT 1;
ALTER TABLE `tickets` ADD COLUMN `projectId` BIGINT NOT NULL DEFAULT 1;

--  Drop the default constraint so future inserts require a project ID explicitly
ALTER TABLE `sprints` ALTER COLUMN `projectId` DROP DEFAULT;
ALTER TABLE `tickets` ALTER COLUMN `projectId` DROP DEFAULT;

-- create the indexes 
CREATE INDEX `sprints_projectId_idx` ON `sprints`(`projectId`);
CREATE INDEX `tickets_projectId_idx` ON `tickets`(`projectId`);

-- Alter Table
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Table
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;