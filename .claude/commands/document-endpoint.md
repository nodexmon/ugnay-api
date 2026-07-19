Apply this checklist when adding Swagger/OpenAPI documentation to a new endpoint.

Swagger is served at `/api/docs` (dev/staging only, configured in `src/main.ts`). Only `@ApiTags` and `@ApiBearerAuth` are currently applied at the class level — all method-level decorators are missing from existing controllers.

All imports come from `@nestjs/swagger`.

## Controller class level (check first — usually already done)

```typescript
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('bookings')       // groups endpoints in the Swagger UI
@ApiBearerAuth()           // omit on public controllers (e.g. auth)
@Controller('bookings')
export class BookingsController { ... }
```

## Every endpoint — minimum required

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiOperation({ summary: 'Create a booking' })
@ApiResponse({ status: 201, description: 'Booking created.' })
@ApiResponse({ status: 400, description: 'Invalid input.' })
@ApiResponse({ status: 403, description: 'Forbidden.' })
@Post()
create(...) { ... }
```

## Query string parameters

```typescript
import { ApiQuery } from '@nestjs/swagger';

@ApiQuery({ name: 'skip', type: Number, required: false, example: 0 })
@ApiQuery({ name: 'take', type: Number, required: false, example: 10 })
@Get()
findAll(@Query() query: FindUsersQueryDto) { ... }
```

## Path parameters

```typescript
import { ApiParam } from '@nestjs/swagger';

@ApiParam({ name: 'id', type: String, description: 'Resource UUID' })
@Get(':id')
findOne(@Param('id', new ParseUUIDPipe()) id: string) { ... }
```

## DTO properties (new DTOs only)

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  workerId: string;

  @ApiProperty({ enum: BookingType })
  @IsEnum(BookingType)
  bookingType: BookingType;
}
```

Add `@ApiProperty()` to new DTOs as you write them. Do not retrofit existing DTOs in the same PR as a feature change.

## Standard response codes

| Status | When |
|---|---|
| 200 | GET success |
| 201 | POST success (resource created) |
| 400 | Validation failure / bad input |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but wrong role or ownership |
| 404 | Resource not found |
| 409 | Conflict (wrong state, duplicate) |

Only document the codes that actually apply to the endpoint.

## Rules

- `@ApiBearerAuth()` needs no extra setup — `main.ts` already calls `.addBearerAuth()` globally.
- Place Swagger decorators **above** the HTTP method decorator (`@Get`, `@Post`, etc.) for readability.
- `@ApiOperation` and at least one `@ApiResponse` are required on every new endpoint.
- `@ApiQuery` / `@ApiParam` are required whenever the endpoint accepts query or path params.
