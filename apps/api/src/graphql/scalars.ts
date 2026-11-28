import { GraphQLError, GraphQLScalarType, Kind, type ValueNode } from "graphql";

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new GraphQLError("DateTime cannot represent an invalid Date.", {
        extensions: { code: "VALIDATION_FAILED" },
      });
    }
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError(
        `DateTime cannot represent an invalid date: ${String(value)}.`,
        { extensions: { code: "VALIDATION_FAILED" } },
      );
    }
    return date.toISOString();
  }

  throw new GraphQLError(`DateTime cannot represent value: ${String(value)}.`, {
    extensions: { code: "VALIDATION_FAILED" },
  });
}

function parseInput(value: unknown): string {
  if (value instanceof Date) return toIsoString(value);
  if (typeof value !== "string") {
    throw new GraphQLError(
      `DateTime must be an ISO-8601 string, got ${typeof value}.`,
      { extensions: { code: "VALIDATION_FAILED" } },
    );
  }
  if (Number.isNaN(new Date(value).getTime())) {
    throw new GraphQLError(
      `DateTime cannot represent an invalid date: ${value}.`,
      {
        extensions: { code: "VALIDATION_FAILED" },
      },
    );
  }
  // Preserve the exact wire representation: offline/order signatures are
  // computed over the client-provided canonical bytes.
  return value;
}

function parseLiteral(node: ValueNode): string {
  if (node.kind !== Kind.STRING) {
    throw new GraphQLError(
      `DateTime must be an ISO-8601 string, got ${node.kind}.`,
      { extensions: { code: "VALIDATION_FAILED" } },
    );
  }

  return parseInput(node.value);
}

/**
 * ISO-8601 UTC timestamps. Values are serialized as strings; money and
 * quantities never pass through Float.
 */
export const DateTimeScalar = new GraphQLScalarType<string>({
  name: "DateTime",
  serialize: toIsoString,
  parseValue: parseInput,
  parseLiteral,
});
