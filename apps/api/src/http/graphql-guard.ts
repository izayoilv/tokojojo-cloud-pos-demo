import type { RequestHandler } from "express";
import {
  type DocumentNode,
  type FragmentDefinitionNode,
  Kind,
  parse,
  type SelectionSetNode,
} from "graphql";

export interface QueryMetrics {
  depth: number;
  complexity: number;
}

interface SelectionMetrics {
  depth: number;
  complexity: number;
}

function fragmentSelection(
  node: FragmentDefinitionNode,
  fragments: Map<string, FragmentDefinitionNode>,
  active: Set<string>,
): SelectionMetrics {
  if (active.has(node.name.value)) {
    return { depth: 0, complexity: 0 };
  }
  const next = new Set(active);
  next.add(node.name.value);
  return selectionMetrics(node.selectionSet, fragments, next);
}

function selectionMetrics(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  active: Set<string> = new Set(),
): SelectionMetrics {
  let depth = 0;
  let complexity = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      complexity += 1;
      const child = selection.selectionSet
        ? selectionMetrics(selection.selectionSet, fragments, active)
        : { depth: 0, complexity: 0 };
      complexity += child.complexity;
      depth = Math.max(depth, 1 + child.depth);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const child = selectionMetrics(selection.selectionSet, fragments, active);
      depth = Math.max(depth, child.depth);
      complexity += child.complexity;
      continue;
    }

    const fragment = fragments.get(selection.name.value);
    if (!fragment) continue;
    const child = fragmentSelection(fragment, fragments, active);
    depth = Math.max(depth, child.depth);
    complexity += child.complexity;
  }

  return { depth, complexity };
}

export function analyzeGraphQLQuery(query: string): QueryMetrics {
  const document: DocumentNode = parse(query);
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  let depth = 0;
  let complexity = 0;
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    const metrics = selectionMetrics(definition.selectionSet, fragments);
    depth = Math.max(depth, metrics.depth);
    complexity = Math.max(complexity, metrics.complexity);
  }
  return { depth, complexity };
}

interface GraphQLGuardOptions {
  maxDepth?: number;
  maxComplexity?: number;
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value! : fallback;
}

export function graphqlGuardMiddleware(
  options: GraphQLGuardOptions = {},
): RequestHandler {
  const maxDepth = positiveLimit(
    options.maxDepth ?? Number(process.env.GRAPHQL_MAX_DEPTH),
    15,
  );
  const maxComplexity = positiveLimit(
    options.maxComplexity ?? Number(process.env.GRAPHQL_MAX_COMPLEXITY),
    1000,
  );

  return (request, response, next) => {
    const bodyQuery =
      request.body && typeof request.body === "object"
        ? (request.body as { query?: unknown }).query
        : null;
    const query =
      typeof bodyQuery === "string"
        ? bodyQuery
        : typeof request.query.query === "string"
          ? request.query.query
          : null;
    if (!query) {
      next();
      return;
    }

    let metrics: QueryMetrics;
    try {
      metrics = analyzeGraphQLQuery(query);
    } catch {
      next();
      return;
    }

    if (metrics.depth > maxDepth || metrics.complexity > maxComplexity) {
      response.status(400).json({
        errors: [
          {
            message: "Query melebihi batas kedalaman atau kompleksitas.",
            extensions: { code: "VALIDATION_FAILED" },
          },
        ],
      });
      return;
    }

    next();
  };
}
