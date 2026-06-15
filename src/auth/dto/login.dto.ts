import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, registerDecorator, ValidateIf } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

function CredentialsXorRefreshToken(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'credentialsXorRefreshToken',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(_value: unknown, args) {
                    const dto = args.object as LoginDto;
                    const hasCredentials = Boolean(dto.email) || Boolean(dto.password);
                    const hasRefreshToken = Boolean(dto.refreshToken);
                    return (hasCredentials && !hasRefreshToken) || (!hasCredentials && hasRefreshToken);
                },
                defaultMessage() {
                    return 'Provide either email and password or refreshToken, but not both';
                },
            },
        });
    };
}

@ApiSchema({ name: 'Auth.Login', description: 'Payload used to login and get an access token used for authentication' })
export class LoginDto {
    @ValidateIf(o => !o.refreshToken)
    @IsEmail()
    @IsNotEmpty()
    @ApiPropertyOptional({
        description: 'User email used during the registration. Required when no refreshToken is provided',
        example: 'some.email@example.com',
    })
    email?: string;

    @ValidateIf(o => !o.refreshToken)
    @IsNotEmpty()
    @ApiPropertyOptional({ description: 'User password used during the registration. Required when no refreshToken is provided' })
    password?: string;

    @IsOptional()
    @IsString()
    @CredentialsXorRefreshToken()
    @ApiPropertyOptional({
        description: 'Refresh token used to obtain a new access token without providing the credentials again',
    })
    refreshToken?: string;
}
