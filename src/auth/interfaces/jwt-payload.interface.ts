import { UserRole } from 'users/interfaces';

export interface JwtPayload {
    sub: string;
}

export interface AuthenticatedUser {
    userId: string;
    email: string;
    role: UserRole;
}
