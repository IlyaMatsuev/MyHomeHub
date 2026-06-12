import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model, FilterQuery } from 'mongoose';
import { PaginationResponseDto } from 'common/dto';
import { RegistrationRequest, RegistrationRequestStatus } from 'users/interfaces';
import {
    CreateRegistrationRequestDto,
    GetRegistrationRequestsDto,
    RegistrationRequestResponseDto,
    UpdateRegistrationRequestDto,
} from 'users/dto';
import { REGISTRATION_REQUEST_MODEL_PROVIDER_NAME, REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT } from 'users/users.constants';

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

    async getRequest(externalIdOrEmail: string): Promise<RegistrationRequestResponseDto> {
        const request = await this.findByExternalIdOrEmail(externalIdOrEmail);
        if (!request) {
            throw new NotFoundException('Registration request not found');
        }
        return new RegistrationRequestResponseDto(request);
    }

    async createRequest(dto: CreateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        const existingRequest = await this.registrationRequestModel.findOne({ userEmail: dto.email.toLowerCase() }).exec();

        if (existingRequest) {
            if (existingRequest.status === RegistrationRequestStatus.PENDING) {
                throw new BadRequestException('A pending registration request for this email already exists');
            }
            if (existingRequest.status === RegistrationRequestStatus.APPROVED) {
                throw new BadRequestException('A registration request for this email has already been approved');
            }
            if (existingRequest.status === RegistrationRequestStatus.REJECTED) {
                if (existingRequest.blackListed) {
                    throw new ForbiddenException('Registration requests from this email are not allowed');
                }
                existingRequest.status = RegistrationRequestStatus.PENDING;
                existingRequest.comment = dto.comment;
                const updatedRequest = await existingRequest.save();
                return new RegistrationRequestResponseDto(updatedRequest);
            }
        }

        const newRequest = new this.registrationRequestModel({
            userEmail: dto.email.toLowerCase(),
            status: RegistrationRequestStatus.PENDING,
            comment: dto.comment,
        });
        const savedRequest = await newRequest.save({ validateBeforeSave: true });
        return new RegistrationRequestResponseDto(savedRequest);
    }

    async updateRequest(externalIdOrEmail: string, dto: UpdateRegistrationRequestDto): Promise<RegistrationRequestResponseDto> {
        if (dto.approve && dto.blackListed) {
            throw new BadRequestException('Cannot approve and blacklist at the same time');
        }

        const request = await this.findByExternalIdOrEmail(externalIdOrEmail);
        if (!request) {
            throw new NotFoundException('Registration request not found');
        }

        request.status = dto.approve ? RegistrationRequestStatus.APPROVED : RegistrationRequestStatus.REJECTED;
        if (dto.blackListed !== undefined) {
            request.blackListed = dto.blackListed;
        }

        const updatedRequest = await request.save();
        return new RegistrationRequestResponseDto(updatedRequest);
    }

    async createAutoApprovedRequest(email: string): Promise<RegistrationRequest> {
        const existingRequest = await this.registrationRequestModel.findOne({ userEmail: email.toLowerCase() }).exec();

        if (existingRequest) {
            existingRequest.status = RegistrationRequestStatus.APPROVED;
            existingRequest.comment = REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT;
            return existingRequest.save();
        }

        const newRequest = new this.registrationRequestModel({
            userEmail: email.toLowerCase(),
            status: RegistrationRequestStatus.APPROVED,
            comment: REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT,
        });
        return newRequest.save({ validateBeforeSave: true });
    }

    async findByEmail(email: string): Promise<RegistrationRequest | null> {
        return this.registrationRequestModel.findOne({ userEmail: email.toLowerCase() }).exec();
    }

    private async findByExternalIdOrEmail(externalIdOrEmail: string): Promise<RegistrationRequest | null> {
        return this.registrationRequestModel
            .findOne({
                $or: [{ externalId: externalIdOrEmail }, { userEmail: externalIdOrEmail.toLowerCase() }],
            })
            .exec();
    }
}
