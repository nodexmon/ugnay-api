Apply this checklist when deleting a route from any controller. Work through each step in order — missing one leaves orphaned code that accumulates silently.

## 1. Controller

Remove the route method and every decorator stacked on it:

```typescript
// Delete all of this:
@CheckAbility(Action.Read, 'WorkerProfile')
@ApiOperation({ summary: '...' })
@ApiResponse({ status: 200, description: '...' })
@ApiParam({ name: 'id', type: String })
@Get(':id')
findOne(@Param('id', new ParseUUIDPipe()) id: string) { ... }
```

## 2. Service method

Before deleting, grep the method name across `src/`:

```bash
pnpm rg "this\.service\.myMethod\|\.myMethod(" src/
```

If another route or service method calls it, **do not delete** — only remove the call site from the deleted route. Delete the service method only when it has no remaining callers.

## 3. Assertions methods

For each `assert*` / `find*` method in `[name].assertions.ts` that the service method called, grep before deleting:

```bash
pnpm rg "this\.assertions\.assertMyMethod\|this\.assertions\.findMyMethod" src/
```

Delete only if the count is zero.

## 4. DTO files

Grep the DTO class name before deleting the file:

```bash
pnpm rg "MyDto" src/
```

Delete `dto/my.dto.ts` only if no other file imports it.

## 5. CASL permission

Check if the `Action + Subject` pair from the removed `@CheckAbility` is still used elsewhere:

```bash
pnpm rg "Action\.Read.*WorkerProfile\|CheckAbility.*Read.*WorkerProfile" src/
```

If the pair is truly unused, remove the matching `can(Action.Read, 'WorkerProfile')` grant from `src/casl/casl-ability.factory.ts`. If other routes still use it, leave the grant alone.

## 6. Tests

- **Controller spec** — remove the `it()` block(s) that test this route.
- **Service spec** — remove the `describe` block(s) for the removed method.
- **Assertions spec** — remove `describe` block(s) for any deleted assertion methods.
- **E2E** — search `test/e2e/` for the endpoint path string and remove those test cases.

## 7. Swagger

Swagger docs disappear automatically when the route is removed. No action needed.

## 8. Handout (always missed)

Update `docs/UGNAY_API_HANDOUT.md` manually:
- Remove the endpoint's request/response section.
- Remove any reference to it in flow diagrams or "typical flows" sections.
- If it was the only endpoint in a feature section, remove the section heading too.

---

## Final check

```bash
pnpm test
```

All 216 tests must pass. A failing import after deletion means a grep missed something.

---

## Rules

- Grep before deleting anything — another caller may exist.
- No commented-out code — delete entirely.
- The handout is not auto-updated by anything; it will silently go stale if you skip step 8.
