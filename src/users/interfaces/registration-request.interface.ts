import { Document } from 'mongoose';
import { UserRole } from './user.interface';

export enum RegistrationRequestStatus {
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected',
    Cancelled = 'cancelled',
}

export interface RegistrationRequest extends Document<string> {
    externalId: string;
    requesterEmail: string;
    requesterComment?: string;
    status: RegistrationRequestStatus;
    role: UserRole;
    blackListed?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
