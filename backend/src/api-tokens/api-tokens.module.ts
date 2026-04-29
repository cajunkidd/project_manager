import { Global, Module } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';

@Global()
@Module({
  providers: [ApiTokensService],
  controllers: [ApiTokensController],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
