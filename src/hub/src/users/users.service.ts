import { BadRequestException, Injectable } from '@nestjs/common';
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

    async create(email: string, passwordHash: string): Promise<User> {
        const user = await this.findByEmail(email);
        if (user) {
            throw new BadRequestException('User with the provided email already exists');
        }

        const nextId = users[users.length - 1].id + 1;
        const newUser = { id: nextId, email, password: passwordHash };
        users.push(newUser);
        return newUser;
    }
}
