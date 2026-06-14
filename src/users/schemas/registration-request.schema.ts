import * as mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RegistrationRequestStatus } from 'users/interfaces';

export const RegistrationRequestSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            required: true,
            unique: true,
            default: uuidv4,
            index: true,
        },
        requesterEmail: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        requesterComment: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        status: {
            type: String,
            required: true,
            enum: Object.values(RegistrationRequestStatus),
            default: RegistrationRequestStatus.Pending,
        },
        blackListed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);
