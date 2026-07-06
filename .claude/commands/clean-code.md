Apply these clean coding principles to everything you write or modify in this session.

## Naming
- Names must reveal intent. If you need a comment to explain a variable, rename it instead.
- Functions and methods: verb phrases (`createBooking`, `assertUserIsActive`)
- Booleans: `is`, `has`, `can` prefix (`isOnline`, `hasExpired`)
- No abbreviations unless universally known (`id`, `dto`, `url` are fine; `usr`, `bkng` are not)

## Functions
- One function, one job. If the function does two things, split it.
- Keep functions short — if it doesn't fit on a screen, it's doing too much.
- No more than 3 parameters. If you need more, use a single object/DTO.
- No flag parameters (`doSomething(true)`). Use two named functions instead.

## Code structure
- No magic numbers or strings — use named constants or config values.
- No deeply nested conditionals — use early returns and guard clauses.
- DRY: if the same logic appears twice, extract it. Three times is non-negotiable.
- Delete dead code. Don't comment it out.

## Comments
- Only comment the WHY, never the WHAT. Well-named code explains itself.
- No block comments narrating what the function does step by step.
- If you need a comment to explain a workaround, include the reason (e.g. a bug reference or constraint).

## General
- No `any` types. Use `unknown` and narrow, or define a proper type.
- No `console.log`. Use the project logger.
- No TODO comments left in committed code.
- Leave the code cleaner than you found it.
