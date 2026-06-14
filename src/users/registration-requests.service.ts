import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model, FilterQuery } from 'mongoose';
import { PaginationResponseDto } from 'common/dto';
import { FieldValidationException } from 'common/exceptions';
import { RegistrationRequest, RegistrationRequestStatus } from 'users/interfaces';
import { REGISTRATION_REQUEST_MODEL_PROVIDER_NAME, REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT } from 'users/users.constants';
import {
    CreateRegistrationRequestDto,
    GetRegistrationRequestsDto,
    RegistrationRequestResponseDto,
    UpdateRegistrationRequestDto,
} from 'users/dto';

@Injectable()
export class RegistrationRequestsService {
    constructor(
        @Inject(REGISTRATION_REQUEST_MODEL_PROVIDER_NAME)
        private readonly registrationRequestModel: Model<RegistrationRequest>,
    ) {}

    async getRequests(query: GetRegistrationRequestsDto): Promise<PaginationResponseDto<RegistrationRequestResponseDto>> {
        const filter: FilterQuery<RegistrationRequest> = {};
        if (query.status) {
            filter.status = query.status;
        }

        const [requests, totalItems] = await Promise.all([
            this.registrationRequestModel.find(filter).skip(query.skipRecords).limit(query.pageSize).sort({ createdAt: -1 }).exec(),
            this.registrationRequestModel.countDocuments(filter).exec(),
        ]);

        return new PaginationResponseDto(
            requests.map(r => new RegistrationRequestResponseDto(r)),
            query.page,
            query.pageSize,
            totalItems,
        );
    }

    async getRequestByEmail(email: string, options: { strict: boolean } = { strict: false }): Promise<RegistrationRequest | null> {
        const request = await this.registrationRequestModel.findOne({ requesterEmail: email.toLowerCase() }).exec();
        if (!request && options.strict) {
            throw new NotFoundException('Registration request not found');
        }
        return request;
    }

    async getRequestByExternalId(
        externalId: string,
        options: { strict: boolean } = { strict: false },
    ): Promise<RegistrationRequest | null> {
        const request = await this.registrationRequestModel.findOne({ externalId }).exec();
        if (!request && options.strict) {
            throw new NotFoundException('Registration request not found');
        }
        return request;
    }

    async createRequest(dto: CreateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        const existingRequest = await this.getRequestByEmail(dto.email);
        if (existingRequest) {
            if (existingRequest.status === RegistrationRequestStatus.Pending) {
                throw new FieldValidationException('A pending registration request for this email already exists', 'email');
            }
            if (existingRequest.status === RegistrationRequestStatus.Approved) {
                throw new FieldValidationException('A registration request for this email has already been approved', 'email');
            }
            if (existingRequest.status === RegistrationRequestStatus.Rejected) {
                if (existingRequest.blackListed) {
                    throw new ForbiddenException('Registration requests from this email are not allowed');
                }
                existingRequest.status = RegistrationRequestStatus.Pending;
                existingRequest.requesterComment = dto.comment;
                return new RegistrationRequestResponseDto(await existingRequest.save());
            }
        }
        return this.createNewRequest(dto.email, RegistrationRequestStatus.Pending, dto.comment);
    }

    async createAutoApprovedRequest(email: string): Promise<RegistrationRequestResponseDto> {
        const existingRequest = await this.getRequestByEmail(email);
        if (existingRequest) {
            existingRequest.status = RegistrationRequestStatus.Approved;
            existingRequest.requesterComment = REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT;
            return new RegistrationRequestResponseDto(await existingRequest.save());
        }
        return this.createNewRequest(email, RegistrationRequestStatus.Approved, REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT);
    }

    async updateRequest(externalId: string, dto: UpdateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        if (dto.approve && dto.blackListed) {
            throw new FieldValidationException('Cannot approve and blacklist at the same time', 'blackListed');
        }

        const request = await this.getRequestByExternalId(externalId, { strict: true });
        request.status = dto.approve ? RegistrationRequestStatus.Approved : RegistrationRequestStatus.Rejected;
        if (dto.blackListed !== undefined) {
            request.blackListed = dto.blackListed;
        }

        return new RegistrationRequestResponseDto(await request.save());
    }

    private async createNewRequest(
        requesterEmail: string,
        status: RegistrationRequestStatus,
        requesterComment?: string,
    ): Promise<RegistrationRequestResponseDto> {
        const request = new this.registrationRequestModel({
            requesterEmail: requesterEmail.toLowerCase(),
            status,
            requesterComment: requesterComment,
        });
        return new RegistrationRequestResponseDto(await request.save({ validateBeforeSave: true }));
    }
}
