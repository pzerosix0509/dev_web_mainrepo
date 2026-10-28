export function parseId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function escapeLikePattern(input: string): string {
  return `%${input.replace(/[!%_]/g, '!$&')}%`;
}

export function stringField(value: unknown, field: string, fields: Record<string, string>, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && value.trim() === '')) fields[field] = 'Trường này phải là chuỗi không rỗng';
  return typeof value === 'string' ? value.trim() : undefined;
}

export function integerField(value: unknown, field: string, fields: Record<string, string>, required = true, min = 0) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) fields[field] = `Phải là số nguyên không nhỏ hơn ${min}`;
  return typeof value === 'number' ? value : undefined;
}

export function booleanField(value: unknown, field: string, fields: Record<string, string>, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'boolean') fields[field] = 'Phải là kiểu boolean';
  return typeof value === 'boolean' ? value : undefined;
}

export function idArrayField(value: unknown, field: string, fields: Record<string, string>, required = true) {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item) || item <= 0) || new Set(value).size !== value.length) fields[field] = 'Phải là mảng ID số nguyên dương, không trùng';
  return Array.isArray(value) ? value as number[] : undefined;
}
