import { SetMetadata } from '@nestjs/common';
import { PublicOptions } from 'auth/interfaces';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (options?: PublicOptions) => SetMetadata<string, PublicOptions>(IS_PUBLIC_KEY, { localOnly: false, ...options });
