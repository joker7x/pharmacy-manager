ALTER TABLE `product_catalog` ADD `activeIngredient` text;--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `imagePath` varchar(512);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `category` varchar(255);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `company` varchar(255);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `dosageForm` varchar(128);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `barcode` varchar(128);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `administrationRoute` varchar(128);--> statement-breakpoint
ALTER TABLE `product_catalog` ADD `description` text;--> statement-breakpoint
CREATE INDEX `product_catalog_barcode_idx` ON `product_catalog` (`barcode`);--> statement-breakpoint
CREATE INDEX `product_catalog_company_idx` ON `product_catalog` (`company`);