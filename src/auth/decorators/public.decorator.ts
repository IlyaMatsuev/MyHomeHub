import { SetMetadata } from '@nestjs/common';
import { PublicOptions } from 'auth/interfaces';

export const IS_PUBLIC_KEY = 'isPublic';

// The metadata holds the resolved options object so that a bare @Public() stays truthy
export const Public = (options?: PublicOptions) => SetMetadata<string, PublicOptions>(IS_PUBLIC_KEY, { localOnly: false, ...options });
