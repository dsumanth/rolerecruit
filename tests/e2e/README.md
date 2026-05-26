# E2E Setup

These Playwright tests need:

1. A running local Convex backend (`npx convex dev`)
2. A running Next.js dev server (`npm run dev` on http://localhost:3000)
3. Seeded test data: `npx convex run seed:seedE2E` (idempotent)
4. A Clerk auth state file pointing to an hr_admin user:
   - Run `npx playwright codegen http://localhost:3000` and log in manually
   - Save storage state: `await page.context().storageState({ path: 'tests/e2e/.auth/hr-admin.json' });`
   - Set: `export CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json`
5. Run: `npm run test:e2e`

Without `CLERK_E2E_STORAGE_STATE`, the triage specs auto-skip.

## Directory layout

```
tests/e2e/
  README.md                    # this file
  global-setup.ts              # runs before all tests; seeds Convex + writes .fixtures/seed.json
  fixtures/
    auth.ts                    # extends Playwright test with Clerk storageState fixture
  .fixtures/
    seed.json                  # written by global-setup; contains schoolId, jobIds
  .auth/
    hr-admin.json              # YOU create this; not committed (in .gitignore)
  triage-happy-path.spec.ts
  triage-cross-role.spec.ts
```

## Step-by-step first-time setup

```bash
# 1. Start Convex
npx convex dev &

# 2. Start Next.js
npm run dev &

# 3. Seed test data (idempotent — safe to re-run)
npx convex run seed:seedE2E

# 4. Record Clerk auth state
#    Opens a real browser — log in as your hr_admin test user, then Ctrl+C
npx playwright codegen http://localhost:3000
#    In the Playwright inspector, after logging in, run in the Node console:
#      await page.context().storageState({ path: 'tests/e2e/.auth/hr-admin.json' });

# 5. Export the path
export CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json

# 6. Run triage specs
npm run test:e2e
```

## Notes

- `@clerk/testing` is **not** installed. Auth relies on a pre-recorded storage-state
  file (Playwright's built-in mechanism). If Clerk test-mode credentials become
  available, replace the `storageState` fixture in `fixtures/auth.ts` with
  `setupClerkTestingToken` from `@clerk/testing/playwright`.

- The global setup (`global-setup.ts`) calls `npx convex run seed:seedE2E` and
  writes `tests/e2e/.fixtures/seed.json`. If Convex is not running it exits
  with a clear error message.

- Both `.auth/` and `.fixtures/` are excluded from git (see `.gitignore`).
