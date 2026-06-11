import * as mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RegistrationRequestStatus } from 'auth/interfaces';

export const RegistrationRequestSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            required: true,
            unique: true,
            default: uuidv4,
            index: true,
        },
        userEmail: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        status: {
            type: String,
            required: true,
            enum: Object.values(RegistrationRequestStatus),
            default: RegistrationRequestStatus.PENDING,
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        blackListed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);
