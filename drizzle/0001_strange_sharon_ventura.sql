CREATE TABLE `catalog_sync_state` (
	`id` varchar(40) NOT NULL,
	`nextOffset` int NOT NULL DEFAULT 0,
	`isComplete` boolean NOT NULL DEFAULT false,
	`lastFullSyncAt` timestamp,
	`lastLatestSyncAt` timestamp,
	`lastError` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_sync_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_catalog` (
	`externalId` varchar(64) NOT NULL,
	`name` varchar(512) NOT NULL,
	`arabicName` varchar(512) NOT NULL,
	`currentPrice` decimal(12,2) NOT NULL,
	`previousPrice` decimal(12,2),
	`soldTimes` int NOT NULL DEFAULT 0,
	`sourceUpdatedAt` bigint NOT NULL,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_catalog_externalId` PRIMARY KEY(`externalId`)
);
--> statement-breakpoint
CREATE INDEX `product_catalog_name_idx` ON `product_catalog` (`name`);--> statement-breakpoint
CREATE INDEX `product_catalog_arabic_name_idx` ON `product_catalog` (`arabicName`);--> statement-breakpoint
CREATE INDEX `product_catalog_updated_idx` ON `product_catalog` (`sourceUpdatedAt`);