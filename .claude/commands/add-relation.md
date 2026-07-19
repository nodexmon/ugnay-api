Apply this checklist when adding a new Prisma relation between models. Always run the `/migrate` skill after editing the schema.

## Step 1 — Choose the relation type

| Type | FK placement | Parent field |
|---|---|---|
| One-to-many | FK on the child | Array: `children Child[]` |
| One-to-one | FK + `@unique` on the child | Optional singular: `child Child?` |
| Many-to-many | Explicit join table with two FKs | Array on each parent pointing at the join table |

## Step 2 — Choose the `onDelete` policy

| Policy | When to use | Examples in this codebase |
|---|---|---|
| `Cascade` | Child is owned by parent — delete together | WorkerCategory → WorkerProfile, Strike → WorkerProfile |
| `Restrict` | Prevent parent deletion if child exists | Booking → Customer, Review → WorkerProfile |
| `SetNull` | Keep child but clear the FK — audit trail | OtpRequest → User, Strike → Booking |

**Never omit `onDelete`** — being explicit avoids Prisma's opaque defaults.

## Step 3 — Schema syntax

### One-to-many

```prisma
model Parent {
  id       String  @id @default(uuid()) @db.Uuid
  children Child[]
  @@map("parents")
}

model Child {
  id       String @id @default(uuid()) @db.Uuid
  parentId String @db.Uuid
  parent   Parent @relation(fields: [parentId], references: [id], onDelete: Cascade)

  @@index([parentId])
  @@map("children")
}
```

### One-to-one

```prisma
model Child {
  id       String @id @default(uuid()) @db.Uuid
  parentId String @unique @db.Uuid   // @unique enforces 1:1; no separate @@index needed
  parent   Parent @relation(fields: [parentId], references: [id], onDelete: Cascade)
  @@map("children")
}
```

### Many-to-many (always use an explicit join table)

```prisma
model JoinTable {
  id  String @id @default(uuid()) @db.Uuid
  aId String @db.Uuid
  bId String @db.Uuid

  a ModelA @relation(fields: [aId], references: [id], onDelete: Cascade)
  b ModelB @relation(fields: [bId], references: [id])

  @@unique([aId, bId])   // prevents duplicate pairs
  @@index([aId])         // index the "containing" parent FK
  @@map("join_table")
}
```

Add array fields on both parents pointing at the join table, not at each other.

## Step 4 — Indexing rules

- Every FK field must have `@@index([fkField])` **or** be covered by a `@@unique` constraint.
- Add a composite index `@@index([fkField, statusField])` when queries filter by both in the same `where`.
- Join tables: `@@unique([fk1, fk2])` handles the pair; add `@@index([fk1])` separately for single-FK lookups.

## Step 5 — Verify migration SQL

After `pnpm prisma migrate dev`, open the generated `.sql` file and confirm:
- `ON DELETE CASCADE` / `ON DELETE RESTRICT` / `ON DELETE SET NULL` is present on the FK constraint.
- `CREATE INDEX` exists for each new `@@index`.

## Rules

- Every model uses `@@map("snake_case_name")` — never omit it.
- Never use Prisma's implicit many-to-many syntax — always an explicit join table.
- `NOT NULL` FK columns on a table with existing rows require a default value or a data fill step in the migration SQL before the `NOT NULL` constraint is applied.
