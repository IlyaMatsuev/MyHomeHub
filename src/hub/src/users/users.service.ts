import { Injectable } from '@nestjs/common';
import { User } from 'users/interfaces';

let users: Array<User> = [
    {
        id: 1,
        email: 'john',
        password: 'changeme',
    },
    {
        id: 2,
        email: 'maria',
        password: 'guess',
    },
];

@Injectable()
export class UsersService {
    async findByEmail(email: string): Promise<User | undefined> {
        return users.find(user => user.email === email);
    }
}
