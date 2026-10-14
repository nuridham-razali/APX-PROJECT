# Connect Gmail, Google Calendar and Drive

APEX uses your own Google OAuth Web application. This connection belongs to APEX's backend; connected Codex plugins do not automatically connect APEX. Keep credentials out of chat, node inputs and Vercel.

1. In Google Cloud Console, create/select a project and enable Gmail API, Google Calendar API and Google Drive API.
2. Configure the OAuth consent screen. For an external testing app, add your Google account as a test user. Google may expire testing-mode refresh tokens; reconnect when required.
3. Create an OAuth client of type **Web application**. Add exactly `http://127.0.0.1:8094/callback` as an authorised redirect URI.
4. Privately set `APEX_GOOGLE_CLIENT_ID` and `APEX_GOOGLE_CLIENT_SECRET` in the project's `.env.local`.
5. Run `node runtime/connect-google.mjs`, open `http://127.0.0.1:8094/`, and sign in. APEX requests Gmail, Calendar and Drive read access. To enable sending approval-confirmed email, run `node runtime/connect-google.mjs --allow-mail-send` instead and review the additional Google permission.
6. The helper saves the refresh token privately and exits. Restart the APEX runtime. Tokens are refreshed automatically on use. Each actual Google response verifies permission; having a token alone is not a successful integration test.

Read examples in the node's Structured tool input:

- Email: `{"operation":"read","query":"in:inbox newer_than:7d"}`
- Calendar: `{"operation":"read","start":"2026-10-11T00:00:00+08:00","end":"2026-10-18T00:00:00+08:00"}`
- Drive search: `{"operation":"read","query":"proposal"}`
- Drive document: `{"operation":"read","fileId":"ID_FROM_THE_REAL_SEARCH_RESULT"}`

Email sending requires the Gmail send scope and one-use approval of the exact recipient, subject and text. Accepted sending does not prove delivery. No automatic retry after a failed or uncertain request. Shared-calendar changes, invites, file sharing/deletion and social publishing remain disabled; these need separate approval-backed tools. Read access is not permission to perform those actions.
