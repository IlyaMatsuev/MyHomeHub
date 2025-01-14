import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { User } from 'users/interfaces';
import { USER_MODEL_PROVIDER_NAME } from 'users/users.constants';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
    constructor(
        @Inject(USER_MODEL_PROVIDER_NAME)
        private readonly userModel: Model<User>,
    ) {}

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userModel.findOne({ email }).exec();
    }

    async create(email: string, passwordHash: string): Promise<User> {
        const user = await this.findByEmail(email);
        if (user) {
            throw new BadRequestException('User with the provided email already exists');
        }
        return new this.userModel({ email, password: passwordHash }).save();
    }
}
