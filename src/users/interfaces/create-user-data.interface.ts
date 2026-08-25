import { UserRole } from 'users/interfaces/user.interface';

export interface CreateUserData {
    email: string;
    role: UserRole;
    // Argon2 hash. Not set for the users registered with a Google account
    password?: string;
    // SHA-256 hash of the "sub" claim of the linked Google account
    googleIdHash?: string;
    googleEmail?: string;
}
