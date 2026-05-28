import parsePhoneNumberFromString, { type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "IN";

export function normalizeToE164(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  if (!parsed || !parsed.isValid()) return undefined;
  return parsed.number;
}

export function countryFromPhone(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  return parsed?.country;
}
