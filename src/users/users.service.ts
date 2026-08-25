import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { FieldValidationException } from 'common/exceptions';
import { CreateUserData, User } from 'users/interfaces';
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

    async findByGoogleIdHash(googleIdHash: string): Promise<User | undefined> {
        return this.userModel.findOne({ googleIdHash }).exec();
    }

    async findByExternalId(externalId: string, options: { strict: boolean } = { strict: true }): Promise<User> {
        const user = await this.userModel.findOne({ externalId }).exec();
        if (!user && options.strict) {
            throw new NotFoundException('There is no user matching these criteria');
        }
        return user;
    }

    async create(data: CreateUserData): Promise<User> {
        const user = await this.findByEmail(data.email);
        if (user) {
            throw new FieldValidationException('User with the provided email already exists', 'email');
        }
        return new this.userModel({
            email: data.email,
            password: data.password,
            role: data.role,
            googleIdHash: data.googleIdHash,
            googleEmail: data.googleEmail,
        }).save({ validateBeforeSave: true });
    }

    async updatePassword(externalId: string, passwordHash: string): Promise<User> {
        const user = await this.findByExternalId(externalId);
        user.password = passwordHash;
        return user.save({ validateBeforeSave: true });
    }

    async linkGoogleAccount(externalId: string, googleIdHash: string, googleEmail: string): Promise<User> {
        const user = await this.findByExternalId(externalId);
        user.googleIdHash = googleIdHash;
        user.googleEmail = googleEmail;
        return user.save({ validateBeforeSave: true });
    }

    async unlinkGoogleAccount(externalId: string): Promise<User> {
        const user = await this.findByExternalId(externalId);
        user.googleIdHash = undefined;
        user.googleEmail = undefined;
        return user.save({ validateBeforeSave: true });
    }
}
