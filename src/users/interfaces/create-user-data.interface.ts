import { UserRole } from 'users/interfaces/user.interface';

export interface CreateUserData {
    email: string;
    role: UserRole;
    /** Argon2 hash. Not set for the users registered with a Google account only */
    password?: string;
    googleId?: string;
    googleEmail?: string;
}
