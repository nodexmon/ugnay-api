Apply these standards when writing or fixing spec files in this project.

## Setup
- Use `Test.createTestingModule` from `@nestjs/testing` — never instantiate classes manually.
- Provide only what the class under test actually injects. Do not import real modules.
- Mock every dependency with a plain object of `jest.fn()` values — no real DB, no real HTTP, no file system.
- For **service specs**: mock the assertions class, not Prisma directly:
  `{ provide: BookingsAssertions, useValue: { assertX: jest.fn(), findX: jest.fn() } }`
- For **assertions specs**: mock `PrismaService` directly:
  `{ provide: PrismaService, useValue: { modelName: { findUnique: jest.fn(), ... } } }`
- For config tokens: `{ provide: jwtConfig.KEY, useValue: { JWT_SECRET: '...', ... } }`
- Call `jest.clearAllMocks()` in `beforeEach` — never rely on state from a prior test.

## Structure
- One `describe` block per class, named after the class.
- One `it` per behavior, not per method.
  - Bad: `it('calls prisma.findUnique')`
  - Good: `it('throws NotFoundException when booking does not exist')`
- Order: happy paths first, then edge cases, then error paths.

## What to test
- **Services**: inputs → return value + critical side effects (what was called, with what args).
- **Controllers**: that the right service method is called with the right arguments. Do not re-test service logic.
- **Error paths**: use `expect(...).rejects.toBeInstanceOf(SomeException)` for async throws.

## Assertions
- Assert the contract: return value, exception type, and `toHaveBeenCalledWith` for important calls.
- Do not assert on internal implementation details or call order unless order truly matters.

## ESM and mocking
- `expo-server-sdk` is mocked globally via `moduleNameMapper` in `package.json` — do not import it in tests.
- The Prisma client is also globally mocked — always use the `PrismaService` mock object.
- For any new ESM-only package: add it to `transformIgnorePatterns` and create a mock in `test/`.

## Before finishing
- Run the specific file: `pnpm jest src/path/to/file.spec.ts`
- Run all tests: `pnpm test`
- All tests must pass. Fix failures — never skip or comment them out.
