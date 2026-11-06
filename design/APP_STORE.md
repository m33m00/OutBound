# OutBound: App Store readiness (branch claude/app-store-ready)

Kept apart from BACKLOG.md so the design rounds and this work don't edit the same rows.
John asked on 2026-11-06 for a launch screen, login and sign up with airline emails only, and
everything Apple requires, built in now. He isn't submitting yet.

## Built
| Round | What | Why Apple cares |
|---|---|---|
| 1 | Launch intro: native splash (navy, ring dot) then a Skia route draw, plane, split-flap OUTBOUND, panel lifts away. Tap skips; Reduce Motion gets a short fade | Launch screen required; no long blocking splash |
| 2 | Accounts: sign up, 6-digit email code, log in, forgot password, new password, log out | 2.1(a) needs a working login path for review |
| 2 | Airline emails only: client check plus a server trigger on auth.users against allowed_email_domains; allowed_emails holds one-off addresses (the reviewer account) | 3.2 apps for one organization's staff still need a reviewer login |
| 2 | Delete Account in Profile > Account, deletes on the server (delete_my_account) and clears the phone | 5.1.1(v) account deletion in app |
| 2 | Privacy Policy and Terms in app and as web pages (docs/, GitHub Pages), Contact Support | 5.1.1(i) privacy policy link in app and store |
| 2 | Flag a crowd seat report or answer, hide that person's reports, terms say zero tolerance and 24 hour review | 1.2 user-generated content |
| 2 | "Not affiliated with any airline" line in Profile and Terms | 5.2 trademarks |
| 2 | app.json: bundle ID com.m33m00.outbound, iPhone only, no non-exempt encryption, privacy manifest reasons | Privacy manifest, export compliance |
| 2 | eas.json build and submit profiles; production builds never offer "Look Around First" | Store build config |

## Provisional choices (John may change any time)
- Seeded airline domains are a first guess; confirm with people at each airline before launch.
- Passwords: 8+ characters with a letter and a number. Codes: 6 digits, resend after 60 s.
- Preview builds (Expo Go, TestFlight) can skip sign in with "Look Around First"; store builds can't.
- Not needed: Sign in with Apple (4.8 only applies when offering third-party logins).
- Flags and hides are kept on the phone until shared seat reports go live; then they need a server
  flags table, sender IDs on reports and a review queue.
- DECISIONS.md still says no airline logos; John said yes to Logo.dev on 2026-11-04. Store risk
  under 5.2 is noted for him.

## Submit-day checklist (John's steps, remind him when he's ready)
1. Support email: John will create one later (2026-11-06). Put it in src/legal/documents.json
   contact.email, run `node scripts/build-legal-pages.mjs`, and republish. Until then the app and
   support page fall back to the support page with no email, which Apple won't accept at review.
2. Supabase: push the accounts migration, turn on email confirmations, paste the code templates,
   add custom SMTP so codes reach people.
3. Confirm the seeded airline domains with people at each airline.
4. Reviewer login: add one address to allowed_emails.
5. Merge to main, turn on GitHub Pages from /docs.
6. Apple Developer Program enrollment.
7. App Store Connect listing: privacy answers, age rating, screenshots, support and privacy URLs,
   EU trader status, "not affiliated" line in the description.
8. EAS production env vars, `eas build --profile production`, `eas submit`.

## Waiting
- Message board: John said build it after accounts are switched on (2026-11-06). Not started.
