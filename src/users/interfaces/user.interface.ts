import { Document } from 'mongoose';

export enum UserRole {
    Admin = 'admin',
    Resident = 'resident',
    Guest = 'guest',
}

export interface User extends Document<string> {
    email: string;
    password: string;
    role: UserRole;
}
