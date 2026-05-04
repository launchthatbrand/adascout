# launchthat-plugin-auth

Reusable Convex Auth component for LaunchThat apps that use Convex Auth directly.

## What it provides

- Component schema with `authTables` and reusable auth-adjacent tables:
  - `oauthProviderConfigs`
  - `userIdentityLinks`
  - `oauthStates`
  - `oauthConnections`
- Shared Convex Auth exports:
  - `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`
- Provider presets:
  - password
  - magic link (toggle with `AUTH_ENABLE_MAGIC_LINK=true`)
  - GitHub metadata preset
  - generic OIDC preset
  - web3 metadata preset
- OAuth/admin utility functions:
  - list/upsert/seed provider configs
  - ensure/backfill identity links
  - purge expired OAuth states

## Install in a host app

1. Add component in app Convex config:

```ts
import launchthat_auth from "launchthat-plugin-auth/convex/component/convex.config";

const app = defineApp();
app.use(launchthat_auth);
```

2. Re-export shared auth entrypoints from app `convex/auth.ts`:

```ts
export {
  auth,
  signIn,
  signOut,
  store,
  isAuthenticated,
} from "launchthat-plugin-auth/convex/component/auth";
```

3. Build app auth config from package helper in `convex/auth.config.ts`:

```ts
import { buildConvexAuthConfig } from "launchthat-plugin-auth/auth.config";

export default buildConvexAuthConfig();
```

## Migration/backfill strategy

For existing users, run backfill via app wrapper functions that call component mutations:

- `backfillIdentityLinks`
- `purgeExpiredOauthStates`

Recommended order:

1. Deploy component and wrappers.
2. Seed provider defaults (`seedDefaultProviderConfigs`).
3. Run identity backfill in batches (`limit` argument).
4. Keep compatibility reads active (`getPrimaryIdentityForUser`) during rollout.
5. Purge expired state rows periodically.

