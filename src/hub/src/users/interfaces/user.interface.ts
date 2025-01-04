export interface User {
    id: number;
    email: string;
    password: string;
}

export type NewUser = Omit<User, 'password'>;
