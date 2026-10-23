import type {NoteMutationResult} from './lifecycle'

// A disconnected request must leave the local editor open with its draft intact.
export async function performNoteMutation(
  operation: () => Promise<NoteMutationResult>,
): Promise<NoteMutationResult> {
  try {
    return await operation()
  } catch {
    return {status: 'retryable_error'}
  }
}
