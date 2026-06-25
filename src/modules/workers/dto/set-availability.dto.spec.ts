import { validate } from 'class-validator';
import { SetAvailabilityDto } from '@/modules/workers/dto/set-availability.dto';

describe('SetAvailabilityDto', () => {
  it('accepts a boolean availability value', async () => {
    const dto = new SetAvailabilityDto();
    dto.isOnline = true;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-boolean availability values', async () => {
    const dto = new SetAvailabilityDto();
    dto.isOnline = 'true' as never;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('isOnline');
  });
});
