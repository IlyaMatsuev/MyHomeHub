import { Document } from 'mongoose';

export enum RegistrationRequestStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export interface RegistrationRequest extends Document<string> {
    externalId: string;
    userEmail: string;
    status: RegistrationRequestStatus;
    comment?: string;
    blackListed: boolean;
    createdAt: Date;
    updatedAt: Date;
}
