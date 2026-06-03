import type { UseMutationResult } from "@tanstack/react-query";

type AnyMutation = Pick<
  UseMutationResult<unknown, unknown, any, unknown>,
  "isPending" | "variables"
>;

/**
 * Returns true when a mutation is in-flight for a specific row.
 *
 * Two shapes are supported:
 *
 * 1. Scalar variables — `mutation.mutate(id)`:
 *      isMutationPendingFor(deleteMut, c.id)
 *
 * 2. Object variables — `mutation.mutate({ userId, ... })`:
 *      isMutationPendingFor(roleMut, userId, "userId")
 *      isMutationPendingFor(resetMut, email, "email")
 *
 * Removes the repeated `mut.isPending && mut.variables?.x === y` boilerplate
 * scattered across per-row admin lists.
 */
export function isMutationPendingFor<V>(
  mutation: AnyMutation,
  value: V,
  key?: string,
): boolean {
  if (!mutation.isPending) return false;
  // No key: variables is a scalar (e.g. the id string passed directly to mutate()).
  if (key === undefined) {
    return mutation.variables === value;
  }
  // key provided: variables is an object; check the specified property.
  const vars = mutation.variables as Record<string, unknown> | null | undefined;
  return vars?.[key] === value;
}

/**
 * Curried convenience: pre-bind a mutation (and optional object key) and get a
 * compact `(id) => boolean` predicate.
 *
 *   const pendingDelete = rowPending(deleteMut);            // scalar
 *   const pendingRole   = rowPending(roleMut, "userId");    // object
 */
export function rowPending<V = unknown>(mutation: AnyMutation, key?: string) {
  return (value: V) => isMutationPendingFor(mutation, value, key);
}
