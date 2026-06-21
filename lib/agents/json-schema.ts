import { z } from "zod";

/**
 * Minimal Zod -> JSON Schema converter for the subset we use in agent output
 * schemas: object, string, number, boolean, array, enum, optional, nullable,
 * default, describe. Emits only API-safe keywords (type/properties/required/
 * items/enum/description/additionalProperties) so it works as a tool
 * `input_schema`.
 */
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
      return withDesc({ const: def.value });
    case z.ZodFirstPartyTypeKind.ZodArray:
      return withDesc({ type: "array", items: zodToJsonSchema(def.type) });
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = def.shape();
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const v = value as z.ZodTypeAny;
        properties[key] = zodToJsonSchema(v);
        if (!isOptional(v)) required.push(key);
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
      return zodToJsonSchema(def.innerType);
    default:
      return withDesc({});
  }
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const tn = (schema as any)._def.typeName;
  return (
    tn === z.ZodFirstPartyTypeKind.ZodOptional ||
    tn === z.ZodFirstPartyTypeKind.ZodDefault
  );
}
