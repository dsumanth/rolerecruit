# Mobile E2E (Maestro)

These flows are skipped in CI unless `maestro` is installed and the required env vars are present:

- `EXPO_SEED_EMAIL` - the email seeded by `bun run seed:eval-demo`
- `EXPO_SEED_SESSION_TOKEN` - a pre-issued Better Auth session token bypassing magic link

Run locally:

```bash
maestro test mobile/.maestro/inbox-to-submit.yaml
maestro test mobile/.maestro/dictation.yaml
```

Skip-condition for CI: if `maestro --version` fails, skip the entire stage.
