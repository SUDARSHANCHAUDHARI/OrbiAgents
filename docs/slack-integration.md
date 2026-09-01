# Slack integration

Create and install a Slack app with a bot user and only the `chat:write` OAuth scope. Do not grant `chat:write.public`, history, read, file, user, admin, or impersonation scopes. Invite the bot to each destination conversation, then copy its `xoxb-` token and use **Save bot token from clipboard** in Fleet settings.

OrbiAgents encrypts the token with Electron `safeStorage`; renderer code receives only redacted connection metadata. Connection testing calls Slack's fixed `auth.test` endpoint. Sending calls only `chat.postMessage`, requires an explicit channel id and message plus operator confirmation, disables link/media unfurls, bounds request and response data, and does not retry ambiguous writes. The integration never reads Slack history or posts in the background.

Token creation and workspace installation remain external Slack administrator actions. Clearing the integration removes the encrypted credential and cached workspace identity from local app data.
