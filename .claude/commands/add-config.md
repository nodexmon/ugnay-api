Apply this checklist when adding a new environment variable or replacing a hardcoded value.

## Decide: env var or module constant?

- **Env var** — value differs between environments (dev/staging/prod) or is a secret. Lives in `src/config/`.
- **Module constant** — value is fixed in all environments (business threshold, enum map). Lives in `[name].constants.ts`.

If it's a module constant, add it to the relevant `[name].constants.ts` and stop here.

## Adding an env var

### 1. Create the config factory

```typescript
// src/config/[name].config.ts
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  MY_VAR: z.string().min(1),
  MY_TIMEOUT_MS: z.coerce.number().positive().default(5000),
});

export default registerAs('[name]', () => {
  const parsed = schema.parse(process.env);
  return { myVar: parsed.MY_VAR, myTimeoutMs: parsed.MY_TIMEOUT_MS };
});
```

- Use Zod `.parse()` — it throws at startup if the env is misconfigured.
- Coerce numeric env vars with `z.coerce.number()` — env vars are always strings.
- Export the factory as the default export.

### 2. Register in AppModule

```typescript
ConfigModule.forRoot({
  load: [...existingFactories, nameConfig],
  isGlobal: true,
}),
```

### 3. Inject in the service

```typescript
import type { ConfigType } from '@nestjs/config';
import nameConfig from '@/config/name.config';

constructor(
  @Inject(nameConfig.KEY)
  private readonly config: ConfigType<typeof nameConfig>,
) {}
```

- Use `import type { ConfigType }` to satisfy `isolatedModules`.

### 4. Document in .env.example

```
# [Name] config — description of what it does
MY_VAR=example_value
MY_TIMEOUT_MS=5000
```

Add a comment explaining what the var controls. Never leave it comment-less.

### 5. Update the README

Add the var to the env vars table in `README.md` with its default value and description.

## Rules

- Never read `process.env` directly outside a config factory.
- Never hardcode secrets, URLs, or env-specific values in source files.
- One config factory per concern — do not dump unrelated vars into an existing factory.
