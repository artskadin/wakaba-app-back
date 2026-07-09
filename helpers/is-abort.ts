export function isAbort(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' ||
      (err as NodeJS.ErrnoException).code === 'ABORT_ERR')
  );
}
