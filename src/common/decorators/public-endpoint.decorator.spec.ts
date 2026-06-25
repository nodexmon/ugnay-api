import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  Public,
} from '@/common/decorators/public-endpoint.decorator';

describe('Public decorator', () => {
  it('marks a route handler as public', () => {
    class TestController {
      @Public()
      handler() {
        return undefined;
      }
    }

    const reflector = new Reflector();

    expect(reflector.get(IS_PUBLIC_KEY, TestController.prototype.handler)).toBe(
      true,
    );
  });
});
