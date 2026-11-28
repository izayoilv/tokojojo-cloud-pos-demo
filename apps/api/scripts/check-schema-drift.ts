import { readFileSync } from "node:fs";

import {
  buildSchema,
  getNamedType,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputField,
  type GraphQLNamedType,
  type GraphQLType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  lexicographicSortSchema,
  printSchema,
  validateSchema,
} from "graphql";

import {
  PENDING_OPERATIONS,
  type PendingRoot,
} from "../src/graphql/pending-operations.ts";
import { appSchema } from "../src/graphql/schema.ts";

const contractPath = new URL(
  "../../../packages/graphql/schema.graphql",
  import.meta.url,
);
const contract = buildSchema(readFileSync(contractPath, "utf8"));

const errors: string[] = [];
const roots = ["Query", "Mutation"] as const satisfies readonly PendingRoot[];

if (
  PENDING_OPERATIONS.Query.length > 0 ||
  PENDING_OPERATIONS.Mutation.length > 0
) {
  errors.push("pending-operations allowlist must be empty");
}

function fail(message: string): void {
  errors.push(message);
}

function compareDefaultValue(
  location: string,
  expected: unknown,
  actual: unknown,
): void {
  const expectedKey = JSON.stringify(expected);
  const actualKey = JSON.stringify(actual);
  if (expectedKey !== actualKey) {
    fail(
      `${location} default is ${String(actualKey)}, contract has ${String(expectedKey)}`,
    );
  }
}

function compareArguments(
  location: string,
  expected: readonly GraphQLArgument[],
  actual: readonly GraphQLArgument[],
): void {
  const expectedByName = new Map(expected.map((arg) => [arg.name, arg]));
  const actualByName = new Map(actual.map((arg) => [arg.name, arg]));

  for (const [name, expectedArg] of expectedByName) {
    const actualArg = actualByName.get(name);
    if (!actualArg) {
      fail(`${location}(${name}:) is missing`);
      continue;
    }

    const expectedType = String(expectedArg.type);
    const actualType = String(actualArg.type);
    if (expectedType !== actualType) {
      fail(
        `${location}(${name}:) is ${actualType}, contract has ${expectedType}`,
      );
    }

    compareDefaultValue(
      `${location}(${name}:)`,
      expectedArg.defaultValue,
      actualArg.defaultValue,
    );
  }

  for (const name of actualByName.keys()) {
    if (!expectedByName.has(name)) {
      fail(`${location}(${name}:) is not in the contract`);
    }
  }
}

function compareField(
  location: string,
  expected: GraphQLField<unknown, unknown>,
  actual: GraphQLField<unknown, unknown>,
): void {
  const expectedType = String(expected.type);
  const actualType = String(actual.type);
  if (expectedType !== actualType) {
    fail(`${location} is ${actualType}, contract has ${expectedType}`);
  }

  compareArguments(location, expected.args, actual.args);
}

function compareInputField(
  location: string,
  expected: GraphQLInputField,
  actual: GraphQLInputField,
): void {
  const expectedType = String(expected.type);
  const actualType = String(actual.type);
  if (expectedType !== actualType) {
    fail(`${location} is ${actualType}, contract has ${expectedType}`);
  }

  compareDefaultValue(location, expected.defaultValue, actual.defaultValue);
}

function compareNamedType(
  name: string,
  expected: GraphQLNamedType,
  actual: GraphQLNamedType,
): void {
  if (isObjectType(expected) || isInterfaceType(expected)) {
    if (!isObjectType(actual) && !isInterfaceType(actual)) {
      fail(`type ${name} kind differs from the contract`);
      return;
    }

    const expectedFields = expected.getFields();
    const actualFields = actual.getFields();

    for (const [fieldName, expectedField] of Object.entries(expectedFields)) {
      const actualField = actualFields[fieldName];
      if (!actualField) {
        fail(`${name}.${fieldName} is missing`);
        continue;
      }
      compareField(`${name}.${fieldName}`, expectedField, actualField);
    }

    for (const fieldName of Object.keys(actualFields)) {
      if (!expectedFields[fieldName]) {
        fail(`${name}.${fieldName} is not in the contract`);
      }
    }
    return;
  }

  if (isInputObjectType(expected)) {
    if (!isInputObjectType(actual)) {
      fail(`type ${name} kind differs from the contract`);
      return;
    }

    const expectedFields = expected.getFields();
    const actualFields = actual.getFields();

    for (const [fieldName, expectedField] of Object.entries(expectedFields)) {
      const actualField = actualFields[fieldName];
      if (!actualField) {
        fail(`${name}.${fieldName} is missing`);
        continue;
      }
      compareInputField(`${name}.${fieldName}`, expectedField, actualField);
    }

    for (const fieldName of Object.keys(actualFields)) {
      if (!expectedFields[fieldName]) {
        fail(`${name}.${fieldName} is not in the contract`);
      }
    }
    return;
  }

  if (isEnumType(expected)) {
    if (!isEnumType(actual)) {
      fail(`type ${name} kind differs from the contract`);
      return;
    }

    const expectedValues = expected.getValues().map((value) => value.name);
    const actualValues = actual.getValues().map((value) => value.name);

    if (expectedValues.join(",") !== actualValues.join(",")) {
      fail(
        `enum ${name} is [${actualValues.join(", ")}], contract has [${expectedValues.join(", ")}]`,
      );
    }
    return;
  }

  if (isScalarType(expected) && !isScalarType(actual)) {
    fail(`type ${name} kind differs from the contract`);
  }
}

function collectReachableTypes(
  fields: readonly GraphQLField<unknown, unknown>[],
): Set<string> {
  const seen = new Set<string>();

  const visit = (type: GraphQLType): void => {
    const named = getNamedType(type);
    if (seen.has(named.name)) return;
    seen.add(named.name);

    if (isObjectType(named) || isInterfaceType(named)) {
      for (const field of Object.values(named.getFields())) {
        visit(field.type);
        for (const arg of field.args) visit(arg.type);
      }
      return;
    }

    if (isInputObjectType(named)) {
      for (const field of Object.values(named.getFields())) {
        visit(field.type);
      }
      return;
    }

    if (isUnionType(named)) {
      for (const member of named.getTypes()) visit(member);
    }
  };

  for (const field of fields) {
    visit(field.type);
    for (const arg of field.args) visit(arg.type);
  }

  return seen;
}

const pendingFields: GraphQLField<unknown, unknown>[] = [];

for (const root of roots) {
  const contractRoot =
    root === "Query" ? contract.getQueryType() : contract.getMutationType();
  const localRoot =
    root === "Query" ? appSchema.getQueryType() : appSchema.getMutationType();
  const pending = new Set<string>(PENDING_OPERATIONS[root]);

  const contractFields = contractRoot?.getFields() ?? {};
  const localFields = localRoot?.getFields() ?? {};

  for (const name of pending) {
    const pendingField = contractFields[name];
    if (!pendingField) {
      fail(`pending operation ${root}.${name} is not in the contract`);
      continue;
    }

    if (localFields[name]) {
      fail(
        `pending operation ${root}.${name} is present in Pothos; remove it from pending-operations.ts`,
      );
      continue;
    }

    pendingFields.push(pendingField);
  }

  for (const [name, localField] of Object.entries(localFields)) {
    if (pending.has(name)) continue;

    const contractField = contractFields[name];
    if (!contractField) {
      fail(`${root}.${name} is not in the contract`);
      continue;
    }

    compareField(`${root}.${name}`, contractField, localField);
  }

  for (const name of Object.keys(contractFields)) {
    if (localFields[name] || pending.has(name)) continue;
    fail(`${root}.${name} is missing from Pothos and is not listed as pending`);
  }
}

const builtinTypes = new Set(["String", "Int", "Float", "Boolean", "ID"]);

for (const [name, localType] of Object.entries(appSchema.getTypeMap())) {
  if (name.startsWith("__") || builtinTypes.has(name)) continue;
  if (name === "Query" || name === "Mutation") continue;

  const contractType = contract.getType(name);
  if (!contractType) {
    fail(`type ${name} is not in the contract`);
    continue;
  }

  compareNamedType(name, contractType, localType);
}

const pendingReachableTypes = collectReachableTypes(pendingFields);

for (const name of Object.keys(contract.getTypeMap())) {
  if (name.startsWith("__") || builtinTypes.has(name)) continue;
  if (name === "Query" || name === "Mutation") continue;
  if (appSchema.getType(name)) continue;
  if (pendingReachableTypes.has(name)) continue;

  fail(
    `type ${name} is required by implemented operations but missing from Pothos`,
  );
}

const expectedPrint = printSchema(lexicographicSortSchema(contract));
const actualPrint = printSchema(lexicographicSortSchema(appSchema));
if (expectedPrint !== actualPrint) {
  fail(
    "Pothos printSchema does not exactly match packages/graphql/schema.graphql",
  );
}

for (const schemaError of validateSchema(contract)) {
  fail(`contract is invalid: ${schemaError.message}`);
}

for (const schemaError of validateSchema(appSchema)) {
  fail(`Pothos schema is invalid: ${schemaError.message}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`schema:check: ${error}`);
  console.error(`schema:check: FAILED with ${errors.length} error(s)`);
  process.exit(1);
}

const pendingCount =
  PENDING_OPERATIONS.Query.length + PENDING_OPERATIONS.Mutation.length;

console.log(
  `schema:check: OK — Pothos matches the contract outside ${pendingCount} pending operations`,
);
