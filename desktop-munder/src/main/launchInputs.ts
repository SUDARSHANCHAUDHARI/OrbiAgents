/** Validate caller-owned fields before the application adds internal env/argv.
 * expectedCommand comes from the main process's provider preset, never the caller.
 * Matching a name does not verify the binary resolved through PATH.
 */
export function launchInputError(
  request: { command?: unknown; env?: unknown; shellScript?: unknown },
  expectedCommand: string,
): string | null {
  if (!expectedCommand || !/^[a-zA-Z0-9_-]+$/.test(expectedCommand) || request.command !== expectedCommand)
    return 'Use the selected provider canonical command; custom executables require review';
  if (request.shellScript !== undefined)
    return 'Caller-provided shell scripts are not permitted for agent launch';
  if (request.env !== undefined) {
    if (request.env === null || typeof request.env !== 'object' || Array.isArray(request.env))
      return 'Invalid caller environment';
    if (Object.getPrototypeOf(request.env) !== Object.prototype && Object.getPrototypeOf(request.env) !== null)
      return 'Invalid caller environment';
    if (Reflect.ownKeys(request.env).length)
      return 'Caller environment overrides require explicit review';
  }
  return null;
}
