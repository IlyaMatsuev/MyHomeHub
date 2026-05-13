import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScenarioGroupsService } from './scenario-groups.service';
import { SCENARIO_GROUP_MODEL_PROVIDER_NAME, SCENARIO_MODEL_PROVIDER_NAME } from './scenarios.constants';
import { ScenarioGroup } from './interfaces';
import { GetScenarioGroupsDto } from './dto';

describe('ScenarioGroupsService', () => {
    let service: ScenarioGroupsService;
    let mockScenarioGroupModel: {
        find: jest.Mock;
        findOne: jest.Mock;
        deleteOne: jest.Mock;
        deleteMany: jest.Mock;
        updateMany: jest.Mock;
        new: jest.Mock;
    };
    let mockScenarioModel: {
        deleteMany: jest.Mock;
        updateMany: jest.Mock;
    };

    const mockGroup: Partial<ScenarioGroup> = {
        _id: 'mongo-id-123',
        name: 'test_group',
        scenariosCount: 2,
    };

    beforeEach(async () => {
        const MockScenarioGroupModel = jest.fn().mockImplementation(function (data) {
            return {
                ...mockGroup,
                ...data,
                save: jest.fn().mockResolvedValue({ ...mockGroup, ...data }),
            };
        }) as jest.Mock & {
            find: jest.Mock;
            findOne: jest.Mock;
            deleteOne: jest.Mock;
        };
        MockScenarioGroupModel.find = jest.fn();
        MockScenarioGroupModel.findOne = jest.fn();
        MockScenarioGroupModel.deleteOne = jest.fn();

        mockScenarioGroupModel = MockScenarioGroupModel as unknown as typeof mockScenarioGroupModel;
        mockScenarioModel = {
            deleteMany: jest.fn(),
            updateMany: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScenarioGroupsService,
                {
                    provide: SCENARIO_GROUP_MODEL_PROVIDER_NAME,
                    useValue: mockScenarioGroupModel,
                },
                {
                    provide: SCENARIO_MODEL_PROVIDER_NAME,
                    useValue: mockScenarioModel,
                },
            ],
        }).compile();

        service = module.get<ScenarioGroupsService>(ScenarioGroupsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getGroups', () => {
        it('should return paginated groups when no term provided', async () => {
            const groups = [mockGroup];
            mockScenarioGroupModel.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    skip: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(groups),
                        }),
                    }),
                }),
            });
            (mockScenarioGroupModel as unknown as { countDocuments: jest.Mock }).countDocuments = jest.fn().mockResolvedValue(1);

            const result = await service.getGroups();

            expect(result.groups).toEqual(groups);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
            expect(mockScenarioGroupModel.find).toHaveBeenCalledWith({});
        });

        it('should filter groups by term when provided', async () => {
            const groups = [mockGroup];
            mockScenarioGroupModel.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    skip: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(groups),
                        }),
                    }),
                }),
            });
            (mockScenarioGroupModel as unknown as { countDocuments: jest.Mock }).countDocuments = jest.fn().mockResolvedValue(1);

            const options = new GetScenarioGroupsDto();
            options.term = 'test';
            const result = await service.getGroups(options);

            expect(result.groups).toEqual(groups);
            expect(mockScenarioGroupModel.find).toHaveBeenCalledWith({
                name: { $regex: 'test', $options: 'i' },
            });
        });
    });

    describe('getGroupByName', () => {
        it('should return group when found by name', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockGroup),
            });

            const result = await service.getGroupByName('test_group');

            expect(result).toEqual(mockGroup);
            expect(mockScenarioGroupModel.findOne).toHaveBeenCalledWith({ name: 'test_group' });
        });

        it('should throw NotFoundException when group not found', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getGroupByName('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('deleteGroup', () => {
        it('should delete group with no scenarios', async () => {
            const emptyGroup = { ...mockGroup, scenariosCount: 0 } as ScenarioGroup;
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(emptyGroup),
            });
            mockScenarioGroupModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            const result = await service.deleteGroup('1');

            expect(result).toEqual(emptyGroup);
            expect(mockScenarioGroupModel.deleteOne).toHaveBeenCalledWith({ _id: mockGroup._id });
        });

        it('should throw BadRequestException when group has scenarios and deleteScenarios not provided', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockGroup),
            });

            await expect(service.deleteGroup('1')).rejects.toThrow(BadRequestException);
        });

        it('should delete group and scenarios when deleteScenarios is true', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockGroup),
            });
            mockScenarioModel.deleteMany.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
            });
            mockScenarioGroupModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            const result = await service.deleteGroup('1', true);

            expect(result).toEqual(mockGroup);
            expect(mockScenarioModel.deleteMany).toHaveBeenCalledWith({ group: mockGroup.name });
            expect(mockScenarioGroupModel.deleteOne).toHaveBeenCalledWith({ _id: mockGroup._id });
        });

        it('should delete group and clear scenarios group field when deleteScenarios is false', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockGroup),
            });
            mockScenarioModel.updateMany.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
            });
            mockScenarioGroupModel.deleteOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            });

            const result = await service.deleteGroup('1', false);

            expect(result).toEqual(mockGroup);
            expect(mockScenarioModel.updateMany).toHaveBeenCalledWith({ group: mockGroup.name }, { $unset: { group: 1 } });
            expect(mockScenarioGroupModel.deleteOne).toHaveBeenCalledWith({ _id: mockGroup._id });
        });
    });

    describe('syncGroupOnCreate', () => {
        it('should do nothing when no group name provided', async () => {
            await service.syncGroupOnCreate();

            expect(mockScenarioGroupModel.findOne).not.toHaveBeenCalled();
        });

        it('should create new group when it does not exist', async () => {
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await service.syncGroupOnCreate('new_group');

            expect(mockScenarioGroupModel.findOne).toHaveBeenCalledWith({ name: 'new_group' });
        });

        it('should increment existing group count', async () => {
            const existingGroup = {
                ...mockGroup,
                scenariosCount: 1,
                save: jest.fn().mockResolvedValue({ ...mockGroup, scenariosCount: 2 }),
            };
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existingGroup),
            });

            await service.syncGroupOnCreate('test_group');

            expect(existingGroup.scenariosCount).toBe(2);
            expect(existingGroup.save).toHaveBeenCalled();
        });
    });

    describe('syncGroupOnUpdate', () => {
        it('should do nothing when old and new group are the same', async () => {
            await service.syncGroupOnUpdate('same_group', 'same_group');

            expect(mockScenarioGroupModel.findOne).not.toHaveBeenCalled();
        });

        it('should decrement old group and increment new group', async () => {
            const oldGroup = {
                ...mockGroup,
                name: 'old_group',
                scenariosCount: 2,
                save: jest.fn().mockResolvedValue({ scenariosCount: 1 }),
            };
            mockScenarioGroupModel.findOne
                .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(oldGroup) })
                .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

            await service.syncGroupOnUpdate('old_group', 'new_group');

            expect(oldGroup.scenariosCount).toBe(1);
            expect(oldGroup.save).toHaveBeenCalled();
        });
    });

    describe('syncGroupOnDelete', () => {
        it('should do nothing when no group name provided', async () => {
            await service.syncGroupOnDelete();

            expect(mockScenarioGroupModel.findOne).not.toHaveBeenCalled();
        });

        it('should decrement group count', async () => {
            const group = {
                ...mockGroup,
                scenariosCount: 2,
                save: jest.fn().mockResolvedValue({ scenariosCount: 1 }),
            };
            mockScenarioGroupModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(group),
            });

            await service.syncGroupOnDelete('test_group');

            expect(group.scenariosCount).toBe(1);
            expect(group.save).toHaveBeenCalled();
        });
    });
});
