// Turns a kind's JSON Schema (as served by GET /schemas/{kind}) into the
// column and form field definitions the Sheet renders. The schema document
// is the raw contract file: $ref targets into common.schema.json are never
// resolved here, since every property that needs one carries an annotation
// next to the $ref saying what it is (x-cartograph-ref for a reference,
// x-cartograph-enum for an enum), which is enough to classify it without
// following the $ref.

export type FieldKind =
  | "string"
  | "enum"
  | "boolean"
  | "integer"
  | "number"
  | "ref"
  | "ref-array"
  | "string-array"
  | "object-array"
  | "ref-object"
  | "unknown";

export interface FieldDef {
  name: string;
  required: boolean;
  kind: FieldKind;
  refKind?: string;
  enumValues?: string[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  format?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JSONSchemaDoc = Record<string, any>;

// The directory kinds this increment built one Sheet for, in the
// order the card lists them.
export const SHEET_KINDS = [
  "Team",
  "BeneficiaryGroup",
  "Resource",
  "Segment",
  "Unit",
  "FundingSource",
  "Gap",
  "Assumption",
  "DataSource",
  "ReportingCycle",
] as const;

export type SheetKind = (typeof SHEET_KINDS)[number];

export function isSheetKind(kind: string): kind is SheetKind {
  return (SHEET_KINDS as readonly string[]).includes(kind);
}

/**
 * Parses spec.properties, in schema order, into FieldDef entries.
 *
 * The name is metadata.name, the Sheet's first column and the dialog's
 * first field. spec.name, which once held it a second time, is deprecated
 * (engine 2.6.0): read from an old manifest, never shown or written.
 */
export function parseSpecFields(schemaDoc: JSONSchemaDoc | undefined): FieldDef[] {
  const specSchema = schemaDoc?.properties?.spec;
  if (!specSchema || typeof specSchema !== "object") return [];
  const properties: Record<string, JSONSchemaDoc> = specSchema.properties ?? {};
  const required: string[] = specSchema.required ?? [];
  return Object.keys(properties)
    .filter((name) => name !== "name")
    .map((name) => {
      const prop = properties[name];
      return { name, required: required.includes(name), ...classify(prop) };
    });
}

function classify(prop: JSONSchemaDoc): Omit<FieldDef, "name" | "required"> {
  if (prop.type === "array") {
    const items: JSONSchemaDoc = prop.items ?? {};
    if (typeof items["x-cartograph-ref"] === "string") {
      return { kind: "ref-array", refKind: items["x-cartograph-ref"], minItems: prop.minItems };
    }
    if (Array.isArray(items.enum)) {
      return { kind: "string-array", enumValues: items.enum, minItems: prop.minItems };
    }
    // A list of records, such as a cycle's named periods: each has its
    // own editor, never a text box.
    if (items.properties && typeof items.properties === "object") {
      return { kind: "object-array", minItems: prop.minItems };
    }
    return { kind: "string-array", minItems: prop.minItems };
  }
  if (typeof prop["x-cartograph-ref"] === "string") {
    return { kind: "ref", refKind: prop["x-cartograph-ref"] };
  }
  // A reference in Cartograph's one shape (kind and id, or an outside
  // party), picked as a Resource or named as text.
  if (typeof prop.$ref === "string" && prop.$ref.endsWith("/Ref")) {
    return { kind: "ref-object", refKind: "Resource" };
  }
  // An enum reached through a $ref into common.schema.json carries the
  // same values beside it as x-cartograph-enum, the way a reference carries
  // x-cartograph-ref: enough to classify the field without following the $ref,
  // which this parser deliberately never does. A server test asserts the
  // annotation and the definition stay identical.
  if (Array.isArray(prop["x-cartograph-enum"])) {
    return { kind: "enum", enumValues: prop["x-cartograph-enum"] };
  }
  if (Array.isArray(prop.enum)) {
    return { kind: "enum", enumValues: prop.enum };
  }
  if (prop.type === "boolean") {
    return { kind: "boolean" };
  }
  if (prop.type === "integer" || prop.type === "number") {
    return { kind: prop.type, minimum: prop.minimum, maximum: prop.maximum };
  }
  if (prop.type === "string") {
    return { kind: "string", maxLength: prop.maxLength, format: prop.format };
  }
  return { kind: "unknown" };
}

// No schema keyword carries a unit today (the contract has no x-cartograph-unit
// convention); these hints are hand-written for the handful of numeric
// fields the seven sheet kinds actually have, keyed by property name since
// no two of them collide across kinds.
const UNIT_HINTS: Record<string, string> = {
  periodMonths: "months",
  startMonth: "month of the year, 1 to 12",
  dueOffsetDays: "days",
  typicalSize: "people",
};

export function unitHint(fieldName: string): string | undefined {
  return UNIT_HINTS[fieldName];
}

/** metadata.id is a slug derived from the name: lowercase, hyphenated. */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s;
}
