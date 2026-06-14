import { Document } from 'mongoose';

export enum RegistrationRequestStatus {
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected',
}

export interface RegistrationRequest extends Document<string> {
    externalId: string;
    requesterEmail: string;
    requesterComment?: string;
    status: RegistrationRequestStatus;
    blackListed?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
