/** Conservative caller-argv boundary for the disabled migration runtime.
 * This is not a sandbox: provider config, environment and executable identity
 * require separate validation before activation. Never echo rejected values.
 */
export function launchConsentError(provider: string, args: readonly string[], autoMode: boolean): string | null {
  if (!Array.isArray(args) || args.some(token => typeof token !== 'string')) return 'Invalid provider arguments';
  if (autoMode === true) return null; // Explicit operator opt-in, not caller-controlled argv.
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (typeof token !== 'string') return 'Invalid provider arguments';
    if (!token.startsWith('-')) continue;
    const equals = token.indexOf('=');
    const flag = equals < 0 ? token : token.slice(0, equals);
    if (provider === 'claude' && flag === '--continue' && equals < 0) continue;
    const ordinary = ['--model', '-m', '--resume', '-r', '--session-id'].includes(flag);
    const permission = provider === 'claude' && flag === '--permission-mode';
    const sandbox = provider === 'codex' && ['--sandbox', '-s'].includes(flag);
    const approval = provider === 'codex' && ['--ask-for-approval', '-a'].includes(flag);
    if (!ordinary && !permission && !sandbox && !approval)
      return 'Provider option requires explicit review while auto mode is disabled';
    const value = equals < 0 ? args[++i] : token.slice(equals + 1);
    if (!value || value.startsWith('-')) return 'Provider option has an invalid or missing value';
    if (permission && !['default', 'plan'].includes(value)) return 'Permission bypass requires operator consent';
    if (sandbox && !['read-only', 'workspace-write'].includes(value)) return 'Sandbox bypass requires operator consent';
    if (approval && !['untrusted', 'on-request'].includes(value)) return 'Approval bypass requires operator consent';
  }
  return null;
}
