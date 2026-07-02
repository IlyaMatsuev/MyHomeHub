import { UserRole } from 'users/interfaces';

export interface AuthenticatedUser {
    userId: string;
    email: string;
    role: UserRole;
}
