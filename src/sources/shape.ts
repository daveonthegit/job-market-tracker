/** Small runtime guards so a changed upstream schema fails loudly instead of yielding junk. */

export type Obj = Record<string, unknown>;

export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function expectArray(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${what}: expected an array`);
  return v;
}

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize a date-ish value to ISO-8601, or null if absent/unparseable. */
export function isoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function lowerTags(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean).map((t) => t.toLowerCase()) : [];
}
