import { useMutation, useQueryClient, type QueryKey, type UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

type ToastMutationOptions<TData, TError, TVariables, TContext> = Omit<
  UseMutationOptions<TData, TError, TVariables, TContext>,
  "onSuccess" | "onError"
> & {
  /** Success toast text. Either a string or a function of the result. Pass null/undefined to skip. */
  successMessage?: string | ((data: TData, variables: TVariables) => string) | null;
  /** Error toast prefix. Defaults to the raw error message. Pass null to suppress. */
  errorMessage?: string | ((error: TError) => string) | null;
  /** Query keys to invalidate on success. */
  invalidate?: QueryKey | QueryKey[];
  /** Extra success handler (runs after toast + invalidate). */
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => unknown | Promise<unknown>;
  /** Extra error handler (runs after the toast). */
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => unknown;
};

/**
 * Standard mutation wrapper that handles the project's repetitive pattern:
 *   onSuccess: () => { toast.success("X"); qc.invalidateQueries(...) }
 *   onError: (e) => toast.error(e.message)
 *
 * Usage:
 *   const mut = useToastMutation({
 *     mutationFn: (input) => fn({ data: input }),
 *     successMessage: "User updated",
 *     invalidate: ["admin", "users"],
 *   });
 */
export function useToastMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: ToastMutationOptions<TData, TError, TVariables, TContext>,
) {
  const qc = useQueryClient();
  const { successMessage, errorMessage, invalidate, onSuccess, onError, ...rest } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    onSuccess: async (data, variables, context) => {
      if (successMessage !== null && successMessage !== undefined) {
        const msg = typeof successMessage === "function" ? successMessage(data, variables) : successMessage;
        if (msg) toast.success(msg);
      }
      if (invalidate) {
        // Detect whether the caller passed a single QueryKey or an array of QueryKeys.
        // A QueryKey is itself an array, so we check if the first element is also an
        // array to distinguish `[["users"]]` (multiple keys) from `["users"]` (one key).
        const keys = Array.isArray(invalidate[0]) ? (invalidate as QueryKey[]) : [invalidate as QueryKey];
        await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
      }
      if (onSuccess) await onSuccess(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (errorMessage !== null) {
        const msg =
          typeof errorMessage === "function"
            ? errorMessage(error)
            // Fall through to the raw error message when no errorMessage override is provided.
            : errorMessage ?? (error as { message?: string })?.message ?? "Something went wrong";
        if (msg) toast.error(msg);
      }
      if (onError) onError(error, variables, context);
    },
  });
}
