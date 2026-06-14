import { UserRole } from 'users/interfaces';

export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
}

export interface AuthenticatedUser {
    userId: string;
    email: string;
    role: UserRole;
}
