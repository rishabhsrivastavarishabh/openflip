## Goal

Give calls their own dedicated settings hub, add a caller-tune (what the caller hears while the other phone rings), and separate the message ringtone from the call ringtone so each can be chosen independently.

## What the user gets

**New "Calls" section in Settings** (`/settings/calls`), grouped as:

- Notifications
  - Voice call notifications (on/off)
  - Video call notifications (on/off)
  - Vibrate on incoming call (on/off)
- Ringtone (played when you receive a call)
  - Choice: Default, Chime, Ding, Pop, Swoosh, Classic, None — with a Preview button per choice
- Caller tune (played to you while the person you're calling is still ringing)
  - Enable caller tune (on/off)
  - Choice: Default (dial tone), Soft, Uplift, Retro, Lo-fi, Silent — with Preview
- Call behaviour
  - Turn on loudspeaker by default (on/off)
  - Allow calls from people you don't follow (on/off)

**Notifications page (existing)** gets a new "Message ringtone" selector, distinct from the call ringtone. The existing "Ringtone" row is renamed to "Notification sound" and now applies to non-message alerts (likes, comments, follows, etc.). Message previews use the new `message_ringtone`.

**Actual call behaviour**
- The incoming-call dialog uses the user's *call ringtone* choice.
- The caller's Call page plays the chosen *caller tune* on loop until the callee accepts (or declines / times out).
- Chat message notifications play the chosen *message ringtone*.

## Technical details

### Schema (migration)

Add columns to `public.notification_settings` (all with sensible defaults so existing users are unaffected):

- `call_ringtone text default 'default'`
- `caller_tune text default 'default'`
- `caller_tune_enabled boolean default true`
- `message_ringtone text default 'chime'`
- `call_notifications boolean default true`
- `video_call_notifications boolean default true`
- `call_vibrate boolean default true`
- `speaker_default_on boolean default false`
- `allow_unknown_callers boolean default true`

The existing `ringtone` column stays as the generic notification-sound choice (renamed in the UI only).

### Sound library (client-only, no assets)

Create `src/lib/callSounds.ts` with WebAudio pattern definitions:
- `RINGTONES` – for incoming-call ringing (already defined inline in `IncomingCallDialog`; move here and extend with "Classic").
- `CALLER_TUNES` – looping patterns for outbound ring (dial-tone, soft arpeggio, uplift, retro, lo-fi, silent).
- `MESSAGE_TONES` – single-shot chime patterns.

Each exports `playPattern(ctx, name, { loop })` returning a `stop()` handle. This avoids shipping audio files and keeps the fix scoped to Tailwind + JS.

### New files

- `src/pages/settings/CallsPage.tsx` – the new page, wired to `notification_settings` with per-field autosave (mirrors existing NotificationSettings pattern) and a small "Preview" button next to each sound choice that plays the pattern for ~2s.
- `src/lib/callSounds.ts` – shared sound patterns and `playPattern` helper.

### Edits

- `src/pages/settings/SettingsLayout.tsx` – add a "Calls" entry (Phone icon) between Notifications and Appearance.
- `src/App.tsx` – register `/settings/calls` route.
- `src/components/calls/IncomingCallDialog.tsx` – read `call_ringtone` (falling back to `ringtone`), respect `call_notifications` / `video_call_notifications`, and use the shared sound library. Fire `navigator.vibrate` when `call_vibrate` is true.
- `src/pages/Call.tsx` – when the current user is the caller and `call.status === 'ringing'`, play the selected caller tune on loop; stop on accept / decline / cleanup. Apply `speaker_default_on` on mount.
- `src/hooks/usePushNotifications.ts` – when the notification is a message, play the `message_ringtone`; otherwise play the existing generic sound. Both are gated by `notification_sound`.
- `src/components/settings/NotificationSettings.tsx` – rename the "Ringtone" row to "Notification sound" (still writes to `ringtone`), and add a new "Message ringtone" row that writes to `message_ringtone`.

### Not doing

- No uploading of custom audio files. All tones are generated in-browser to keep the change dependency-free.
- No changes to WebRTC signaling.

Ask if you'd like custom audio-file uploads for caller tunes as a follow-up — that needs storage + a small edge function and is a bigger change.