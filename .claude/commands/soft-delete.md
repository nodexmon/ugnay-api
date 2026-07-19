Apply this checklist when adding soft-delete to a model, or when writing a query that touches a soft-deleteable model.

Only `ServiceCategory` and `Barangay` use soft-delete in this codebase (`isActive Boolean @default(true)`). All other models (User, Booking, WorkerProfile) use hard cascade deletes — do not add `isActive` to them without a deliberate architectural decision.

## Adding isActive to a new model

**Schema:**
```prisma
model MyModel {
  id       String  @id @default(uuid()) @db.Uuid
  isActive Boolean @default(true)
  // ... other fields
  @@map("my_models")
}
```

Do not add `@@index([isActive])` alone — booleans are too low-cardinality. Add a composite index only if queries filter `isActive` together with a high-cardinality field (e.g. `@@index([isActive, status])`).

Then run `/migrate`.

## Service pattern

```typescript
// Public read — always exclude inactive
async findActive() {
  return this.prisma.myModel.findMany({
    where: { isActive: true },
    orderBy: { ... },
  });
}

// Admin read — no filter (admins see everything including inactive)
async findAllForAdmin() {
  return this.prisma.myModel.findMany({ orderBy: { ... } });
}

// Soft-delete — never call prisma.myModel.delete()
async deactivate(id: string) {
  await this.assertions.assertExists(id);
  return this.prisma.myModel.update({
    where: { id },
    data: { isActive: false },
  });
}
```

## Checklist when writing any query on a soft-deleteable model

For every `findMany` / `findFirst` / `findUnique` on `ServiceCategory` or `Barangay`, ask: **should inactive records be included?**

| Context | Filter |
|---|---|
| Public endpoint, mobile client | `where: { isActive: true }` |
| Admin management endpoint | No filter |
| Input validation (user submits a categoryId/barangayId) | Assert active explicitly (see below) |

**Validating user-supplied IDs:**
```typescript
// In the assertions class:
async assertCategoryIsActive(categoryId: string): Promise<void> {
  const cat = await this.prisma.serviceCategory.findFirst({
    where: { id: categoryId, isActive: true },
  });
  if (!cat) throw new NotFoundException('Category not found or inactive.');
}
```

Call this before any write that stores a `categoryId` or `barangayId` (e.g. creating a booking, updating a worker's service area). A booking that references a deactivated category is a silent data-quality bug.

## Rules

- Never call `prisma.myModel.delete()` on a soft-deleteable model.
- Never return inactive records on public/mobile-facing endpoints.
- Always validate `isActive: true` when a user submits a foreign key that points at a soft-deleteable model.
- The controller endpoint for soft-delete uses `DELETE /resource/:id` by convention even though no row is removed.
