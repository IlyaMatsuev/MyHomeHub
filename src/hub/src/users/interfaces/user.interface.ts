import { Document } from 'mongoose';

export interface User extends Document<string> {
    email: string;
    password: string;
}

export interface NewUser {
    id: string;
    email: string;
}
