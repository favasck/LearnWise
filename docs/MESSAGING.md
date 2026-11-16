# Direct messaging

Every portal has an Inbox with a searchable user directory, a Message button for
each active user, conversation history, unread counts and read receipts. All Users
also links directly to the selected user's conversation. Accounts do not need a
linked student, parent or tutor record to use the inbox.

## Deployment

1. Run `docs/sql/direct_messages.sql` once in the LearnWise Supabase SQL editor.
2. Deploy the updated application with its existing Supabase environment variables.
3. Sign in with two test accounts, send a message, reply, and confirm the unread
   count clears when the recipient opens the conversation.

The SQL creates a new table and restricted RPCs. Existing profile policies remain
unchanged. Only sender and recipient can read a message; only the recipient can
update its read receipt. Message bodies and participants cannot be edited or
deleted through the client. Suspended accounts cannot read or send messages.
The contact directory exposes active users' names and roles to signed-in users.

The inbox refreshes every ten seconds and an open conversation every five seconds.
The latest 50 messages load initially, with a Load older messages control. Text
messages support up to 4,000 characters. Failed sends keep the draft and reuse its
message ID on retry to prevent duplicate delivery.

Verification: `node --test tests/messaging.test.js`, `npm test`, `npm run build`.
