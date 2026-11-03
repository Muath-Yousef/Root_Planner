import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { SchemaName } from '../registry/definitions';
import contract from './contract.schema.json';
import manifest from './manifest.schema.json';
import taskDispatch from './task_dispatch.schema.json';
import taskResult from './task_result.schema.json';
import objectiveRoute from './objective_route.schema.json';
import escalation from './escalation_package.schema.json';
import { projectSchema } from './project';

/** The six schemas are the files extracted verbatim from MASTER_REFERENCE_v1.1 §2.2. */
export const SCHEMAS: Record<SchemaName, { $id: string }> = {
  contract, manifest, task_dispatch: taskDispatch, task_result: taskResult, objective_route: objectiveRoute, escalation_package: escalation,
};
export interface ValidationIssue {
  schema: SchemaName | 'project'; path: string; field: string; keyword: string; message: string; code: string;
}
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const s of Object.values(SCHEMAS)) ajv.addSchema(s);
ajv.addSchema(projectSchema);

const dotted = (p: string) => p.split('/').filter(Boolean).join('.');
export function humanize(e: ErrorObject): string {
  const where = e.instancePath ? `“${dotted(e.instancePath)}”` : 'the document';
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case 'required': return `Missing required field “${String(p.missingProperty)}”${e.instancePath ? ` in ${where}` : ''}.`;
    case 'additionalProperties': return `Unknown field “${String(p.additionalProperty)}”${e.instancePath ? ` in ${where}` : ''}.`;
    case 'enum': return `${where} must be one of: ${(p.allowedValues as unknown[]).join(', ')}.`;
    case 'const': return `${where} must be exactly “${String(p.allowedValue)}”.`;
    case 'pattern': return `${where} has the wrong format (expected ${String(p.pattern)}).`;
    case 'type': return `${where} must be of type ${String(p.type)}.`;
    case 'minimum': case 'maximum': return `${where} must be ${e.keyword === 'minimum' ? 'at least' : 'at most'} ${String(p.limit)}.`;
    case 'format': return `${where} must be a valid ${String(p.format)}.`;
    default: return `${where} ${e.message ?? 'is invalid'}.`;
  }
}
export function validateDoc(schema: SchemaName | 'project', data: unknown): ValidationIssue[] {
  const fn = ajv.getSchema(schema === 'project' ? projectSchema.$id : SCHEMAS[schema].$id);
  if (!fn) throw new Error(`Unknown schema ${schema}`);
  if (fn(data)) return [];
  return (fn.errors ?? []).map((e) => {
    const child = e.keyword === 'required' ? String((e.params as { missingProperty: string }).missingProperty)
      : e.keyword === 'additionalProperties' ? String((e.params as { additionalProperty: string }).additionalProperty) : '';
    const path = child ? `${e.instancePath}/${child}` : e.instancePath;
    return { schema, path, field: dotted(path), keyword: e.keyword, message: humanize(e), code: `SCHEMA_${e.keyword.toUpperCase()}` };
  });
}
export const isValid = (schema: SchemaName | 'project', data: unknown) => validateDoc(schema, data).length === 0;
