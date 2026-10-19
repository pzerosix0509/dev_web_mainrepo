import { stringField } from '../../shared/validation.js';

export function validateIngredientBody(body: unknown, partial: boolean) {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const value = { name: stringField(source.name, 'name', fields, !partial), unit: stringField(source.unit, 'unit', fields, !partial) };
  return { value, fields };
}
