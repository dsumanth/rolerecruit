# Mobile E2E (Maestro)

These flows are skipped in CI unless `maestro` is installed and the required env vars are present:

- `EXPO_SEED_EMAIL` - the email seeded by `bun run seed:eval-demo`
- `EXPO_SEED_SESSION_TOKEN` - a pre-issued Better Auth session token bypassing magic link

Run locally:

```bash
maestro test mobile/.maestro/inbox-to-submit.yaml
maestro test mobile/.maestro/dictation.yaml
maestro test mobile/.maestro/hr-schedule-demo.yaml
maestro test mobile/.maestro/hr-template-edit.yaml
```

## Flows

- `inbox-to-submit.yaml` - evaluator signs in, opens an invite, submits a score.
- `dictation.yaml` - evaluator dictates a text response.
- `hr-schedule-demo.yaml` - HR signs in, opens Candidates, picks a candidate, schedules a demo. Seeded environment required.
- `hr-template-edit.yaml` - HR signs in, edits the Principal form template's first field label, saves. Seeded environment required.

Skip-condition for CI: if `maestro --version` fails, skip the entire stage.
