import { z } from "zod";

/**
 * Minimal Zod -> JSON Schema converter for the subset we use in agent output
 * schemas: object, string, number, boolean, array, enum, optional, nullable,
 * default, describe. Emits only API-safe keywords (type/properties/required/
 * items/enum/description/additionalProperties).
 *
 * OpenAI strict `json_schema` mode is the binding constraint here, so the output
 * obeys its rules: every property must appear in `required`, and `const` is not
 * allowed. We therefore (a) emit all object keys as required, representing
 * optional/nullable/default fields as nullable types instead of omitting them
 * from `required`, and (b) convert literals to a single-value `enum`.
 */

/** Add "null" to a converted schema's `type` (and enum, if present). */
function makeNullable(obj: Record<string, any>): Record<string, any> {
  if (Array.isArray(obj.type)) {
    return obj.type.includes("null") ? obj : { ...obj, type: [...obj.type, "null"] };
  }
  if (typeof obj.type === "string") {
    const next: Record<string, any> = { ...obj, type: [obj.type, "null"] };
    if (Array.isArray(obj.enum) && !obj.enum.includes(null)) {
      next.enum = [...obj.enum, null];
    }
    return next;
  }
  return obj;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  const def: any = (schema as any)._def;
  const description: string | undefined = def.description;
  const withDesc = (obj: Record<string, any>) =>
    description ? { ...obj, description } : obj;

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return withDesc({ type: "string" });
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return withDesc({
        type: def.checks?.some((c: any) => c.kind === "int")
          ? "integer"
          : "number",
      });
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return withDesc({ type: "boolean" });
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return withDesc({ type: "string", enum: def.values });
    case z.ZodFirstPartyTypeKind.ZodLiteral:
      // OpenAI strict mode rejects `const`; a single-value enum is equivalent.
      return withDesc({ enum: [def.value] });
    case z.ZodFirstPartyTypeKind.ZodArray:
      return withDesc({ type: "array", items: zodToJsonSchema(def.type) });
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = def.shape();
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
        // Strict mode requires every property in `required`; optionality is
        // expressed via nullability on the property type instead.
        required.push(key);
      }
      return withDesc({
        type: "object",
        properties,
        required,
        additionalProperties: false,
      });
    }
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return withDesc(makeNullable(zodToJsonSchema(def.innerType)));
    default:
      return withDesc({});
  }
}
