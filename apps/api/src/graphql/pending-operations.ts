/**
 * Root operations that exist in packages/graphql/schema.graphql but are not
 * implemented by Pothos yet. The drift guard permits these to be missing; it
 * fails if anything else differs. Remove an operation here when its slice lands.
 *
 * Keep this list explicit: do not generate it from the contract, or a missing
 * resolver would silently become "pending".
 */
export const PENDING_QUERY_OPERATIONS = [] as const;

export const PENDING_MUTATION_OPERATIONS = [] as const;

export const PENDING_OPERATIONS = {
  Query: PENDING_QUERY_OPERATIONS,
  Mutation: PENDING_MUTATION_OPERATIONS,
} as const;

export type PendingRoot = keyof typeof PENDING_OPERATIONS;
