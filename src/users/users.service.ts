import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { FieldValidationException } from 'common/exceptions';
import { User, UserRole } from 'users/interfaces';
import { USER_MODEL_PROVIDER_NAME } from 'users/users.constants';

@Injectable()
export class UsersService {
    constructor(
        @Inject(USER_MODEL_PROVIDER_NAME)
        private readonly userModel: Model<User>,
    ) {}

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userModel.findOne({ email }).exec();
    }

    async getUserByExternalId(externalId: string, options: { strict: boolean } = { strict: true }): Promise<User> {
        const user = await this.userModel.findOne({ externalId }).exec();
        if (!user && options.strict) {
            throw new NotFoundException('There is no user matching these criteria');
        }
        return user;
    }

    async create(email: string, passwordHash: string, role: UserRole): Promise<User> {
        const user = await this.findByEmail(email);
        if (user) {
            throw new FieldValidationException('User with the provided email already exists', 'email');
        }
        return new this.userModel({ email, password: passwordHash, role }).save({ validateBeforeSave: true });
    }
}
