CREATE TABLE `staff_push_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` int,
	`pushDeviceId` int,
	`recipientUserId` int NOT NULL,
	`status` enum('accepted','failed','skipped') NOT NULL DEFAULT 'skipped',
	`ticketId` varchar(128),
	`errorMessage` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_push_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_push_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`expoPushToken` varchar(255) NOT NULL,
	`deviceName` varchar(255) NOT NULL,
	`devicePlatform` varchar(64) NOT NULL,
	`deviceModel` varchar(128),
	`osVersion` varchar(64),
	`appVersion` varchar(64),
	`permissionStatus` enum('granted','denied','undetermined') NOT NULL DEFAULT 'undetermined',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastRegisteredAt` timestamp NOT NULL DEFAULT (now()),
	`lastDeliveredAt` timestamp,
	`invalidatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_push_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_push_devices_expoPushToken_unique` UNIQUE(`expoPushToken`)
);
--> statement-breakpoint
ALTER TABLE `staff_push_deliveries` ADD CONSTRAINT `staff_push_deliveries_notificationId_staff_notifications_id_fk` FOREIGN KEY (`notificationId`) REFERENCES `staff_notifications`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_push_deliveries` ADD CONSTRAINT `staff_push_deliveries_pushDeviceId_staff_push_devices_id_fk` FOREIGN KEY (`pushDeviceId`) REFERENCES `staff_push_devices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_push_deliveries` ADD CONSTRAINT `staff_push_deliveries_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_push_devices` ADD CONSTRAINT `staff_push_devices_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_push_delivery_recipient_idx` ON `staff_push_deliveries` (`recipientUserId`);--> statement-breakpoint
CREATE INDEX `staff_push_delivery_notification_idx` ON `staff_push_deliveries` (`notificationId`);--> statement-breakpoint
CREATE INDEX `staff_push_user_idx` ON `staff_push_devices` (`userId`);--> statement-breakpoint
CREATE INDEX `staff_push_enabled_idx` ON `staff_push_devices` (`isEnabled`);