Apply this checklist when adding a new CASL action, a new subject, or granting an existing action/subject pair to a role.

## Step 1 — Action (only if new)

Add to the `Action` enum in `src/casl/casl.types.ts`:

```typescript
export enum Action {
  // ...existing
  MyAction = 'my-action',
}
```

Skip this step if the action already exists (e.g. `Read`, `Create`, `Update`).

## Step 2 — Subject (only if new)

Add to the `Subject` union type in `src/casl/casl.types.ts`:

```typescript
type Subject =
  | 'ExistingSubject'
  | 'MyNewSubject'   // ← add here
  | 'all';
```

`Subject` is a **string union, not an enum** — do not import or generate it, just extend the union. Skip if the subject already exists.

## Step 3 — Grant in ability factory

Add `can(Action.X, 'Subject')` under the relevant `case Role.X` block in `src/casl/casl-ability.factory.ts`. Only add to roles that should have the permission:

```typescript
case Role.CUSTOMER:
  // ...existing
  can(Action.MyAction, 'MySubject');  // ← add here
  break;
```

Do not add to roles that should NOT have the permission — omission is the denial.

## Step 4 — Test coverage

In `src/casl/casl-ability.factory.spec.ts`, add for every affected role:

```typescript
// Role that SHOULD have it:
it('can MyAction MySubject', () => {
  const ability = factory.createForUser(makeUser(Role.CUSTOMER));
  expect(ability.can(Action.MyAction, 'MySubject')).toBe(true);
});

// Role that should NOT:
it('cannot MyAction MySubject', () => {
  const ability = factory.createForUser(makeUser(Role.WORKER));
  expect(ability.can(Action.MyAction, 'MySubject')).toBe(false);
});
```

`casl.guard.spec.ts` covers the guard enforcement generically — no changes needed there.

## Step 5 — Controller decorator

Apply `@CheckAbility` on every controller method that requires this permission:

```typescript
import { CheckAbility } from '@/common/decorators/check-ability.decorator';
import { Action } from '@/casl/casl.types';

@CheckAbility(Action.MyAction, 'MySubject')
@Patch(':id/my-action')
myAction(
  @CurrentUser() user: AuthJwtPayload,
  @Param('id', new ParseUUIDPipe()) id: string,
) {
  return this.service.myAction(id, user);
}
```

`casl.guard.ts` and `check-ability.decorator.ts` never need changes.

## Rules

- A route with **no** `@CheckAbility` is open to all authenticated users — a silent security hole. Never omit it on protected routes.
- `Action.Manage + 'all'` is ADMIN-only. Never grant `Manage` to `WORKER` or `CUSTOMER`.
- Ownership checks ("this belongs to the caller") go in the **service**, not the guard.

## Before finishing

- `pnpm test` — all tests must pass.
- Run `pnpm jest src/casl/` to spot-check the ability factory and guard specs specifically.
