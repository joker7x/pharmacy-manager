import type { InsertProductCatalog } from "../drizzle/schema";

const asText = (value: string | undefined) => value?.trim() || "";
const asLimitedText = (value: string | undefined, maxLength: number) => {
  const text = asText(value);
  return text ? text.slice(0, maxLength) : null;
};
const asNumber = (value: string | undefined) => {
  const cleaned = asText(value).replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeDrugListRecord(fields: string[]): InsertProductCatalog | null {
  const externalId = asText(fields[0]);
  const name = asText(fields[1]);
  const arabicName = asText(fields[2]);
  if (!/^\d+$/.test(externalId) || (!name && !arabicName)) return null;
  const sourceTimestampIndex = fields.findIndex((value, index) => index >= 14 && /^1\d{9}$/.test(asText(value)));
  const sourceTimestamp = sourceTimestampIndex === -1 ? 0 : (asNumber(fields[sourceTimestampIndex]) ?? 0) * 1000;
  const soldTimes = sourceTimestampIndex > 13 ? (asNumber(fields[sourceTimestampIndex - 1]) ?? 0) : 0;
  const descriptionEnd = sourceTimestampIndex > 13 ? sourceTimestampIndex - 1 : fields.length;
  const description = fields.slice(13, descriptionEnd).join(",").trim();
  const price = asNumber(fields[4]) ?? 0;
  const oldPrice = asNumber(fields[3]);
  return {
    externalId,
    name: (name || arabicName).slice(0, 512),
    arabicName: (arabicName || name).slice(0, 512),
    currentPrice: price.toFixed(2),
    previousPrice: oldPrice === null ? null : oldPrice.toFixed(2),
    soldTimes: Math.max(0, Math.trunc(soldTimes)),
    activeIngredient: asLimitedText(fields[5], 60_000),
    imagePath: asLimitedText(fields[6], 512),
    category: asLimitedText(fields[7], 255),
    company: asLimitedText(fields[8], 255),
    dosageForm: asLimitedText(fields[9], 128),
    unitsPerPackage: Math.max(1, Math.trunc(asNumber(fields[10]) ?? 1)),
    barcode: asLimitedText(fields[11], 128),
    administrationRoute: asLimitedText(fields[12], 128),
    description: description ? description.slice(0, 60_000) : null,
    sourceUpdatedAt: Math.max(0, Math.trunc(sourceTimestamp)),
  };
}

export function normalizeDrugListLine(rawLine: string): InsertProductCatalog | null {
  const line = rawLine.replace(/^\uFEFF/, "").trim();
  return line ? normalizeDrugListRecord(line.split(",")) : null;
}
