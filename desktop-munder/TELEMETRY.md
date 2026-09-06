# OrbiAgents product analytics

Product analytics is disabled by default in OrbiAgents. When an operator opts
in, the implementation accepts only the fixed events and properties below. It
does not send prompts, message contents, paths, repository names, hostnames, or
agent output.

The events:

| Event | Allowed properties |
|---|---|
| `first_run` | none |
| `app_launched` | none |
| `update_applied` | `from_version`, `to_version`, `via` |
| `agent_spawned` | `provider` |
| `onboarding_completed` | `provider` |
| `agent_spawn_attempted` | `provider` |
| `agent_spawn_failed` | `provider`, `reason` |
| `agent_install_started` | `provider`, `rung` |
| `agent_install_finished` | `provider`, `rung`, `outcome` |
| `message_sent` | `surface` |
| `feature_used` | `feature` |
| `session_ended` | `duration_bucket` |

### About `message_sent`

This event counts a human submission, never its content. Its closed `surface`
values are `terminal`, `composer`, `steer`, and `hive`.
