CREATE TABLE `staff_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(128),
	`detail` varchar(500) NOT NULL,
	`metadata` text,
	`deviceName` varchar(255),
	`networkAddress` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`sentByUserId` int,
	`title` varchar(120) NOT NULL,
	`body` varchar(500) NOT NULL,
	`route` varchar(255),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`role` enum('owner','pharmacist','cashier','viewer') NOT NULL DEFAULT 'cashier',
	`permissions` text NOT NULL,
	`status` enum('active','frozen','disabled') NOT NULL DEFAULT 'active',
	`frozenUntil` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_profiles_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `staff_profiles_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`deviceName` varchar(255) NOT NULL,
	`devicePlatform` varchar(64) NOT NULL,
	`appVersion` varchar(64),
	`userAgent` varchar(512),
	`networkAddress` varchar(96),
	`lastActiveAt` timestamp NOT NULL DEFAULT (now()),
	`signedOutAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `staff_audit_logs` ADD CONSTRAINT `staff_audit_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_notifications` ADD CONSTRAINT `staff_notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_notifications` ADD CONSTRAINT `staff_notifications_sentByUserId_users_id_fk` FOREIGN KEY (`sentByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_audit_actor_idx` ON `staff_audit_logs` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `staff_audit_created_idx` ON `staff_audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `staff_notifications_recipient_idx` ON `staff_notifications` (`recipientUserId`);--> statement-breakpoint
CREATE INDEX `staff_notifications_created_idx` ON `staff_notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `staff_profiles_status_idx` ON `staff_profiles` (`status`);--> statement-breakpoint
CREATE INDEX `staff_profiles_role_idx` ON `staff_profiles` (`role`);--> statement-breakpoint
CREATE INDEX `staff_sessions_user_idx` ON `staff_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `staff_sessions_last_active_idx` ON `staff_sessions` (`lastActiveAt`);