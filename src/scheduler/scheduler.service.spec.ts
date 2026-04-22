import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenarioCronTimeAdjustOption, ScenarioCronTriggerSource, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { CronJob } from 'cron';

jest.mock('suncalc', () => ({
    getTimes: jest.fn().mockReturnValue({
        sunrise: new Date('2024-01-01T06:30:00'),
        sunset: new Date('2024-01-01T18:45:00'),
    }),
}));

describe('SchedulerService', () => {
    let service: SchedulerService;
    let mockScenariosService: {
        getScenariosWithAdjustableTime: jest.Mock;
        updateScenario: jest.Mock;
    };
    let mockSchedulerRegistry: {
        addCronJob: jest.Mock;
        deleteCronJob: jest.Mock;
    };
    let mockConfigService: { get: jest.Mock };
    const startedJobs: Array<CronJob> = [];

    beforeEach(async () => {
        mockScenariosService = {
            getScenariosWithAdjustableTime: jest.fn(),
            updateScenario: jest.fn(),
        };
        mockSchedulerRegistry = {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
        };
        mockConfigService = {
            get: jest.fn((key: string) => {
                const config: Record<string, number> = {
                    TZ_LATITUDE: 52.52,
                    TZ_LONGITUDE: 13.405,
                };
                return config[key];
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulerService,
                {
                    provide: ScenariosService,
                    useValue: mockScenariosService,
                },
                {
                    provide: SchedulerRegistry,
                    useValue: mockSchedulerRegistry,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<SchedulerService>(SchedulerService);
    });

    afterEach(() => {
        while (startedJobs.length) {
            startedJobs.pop().stop();
        }
        jest.clearAllMocks();
    });

    describe('scheduleJob', () => {
        it('should create and start a cron job', () => {
            const handler = jest.fn();
            const job = {
                name: 'test-job',
                cron: '0 8 * * *',
                handler,
            };

            const result = service.scheduleJob(job);
            startedJobs.push(result);

            expect(result).toBeInstanceOf(CronJob);
            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith('test-job', expect.any(CronJob));
        });

        it('should execute handler when job runs', () => {
            const handler = jest.fn();
            /* Every second for testing */
            const job = {
                name: 'test-job',
                cron: '* * * * * *',
                handler,
            };

            const cronJob = service.scheduleJob(job);
            startedJobs.push(cronJob);

            // Manually trigger the job callback
            cronJob.fireOnTick();

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('unscheduleJob', () => {
        it('should delete the cron job from registry', () => {
            service.unscheduleJob('test-job');

            expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith('test-job');
        });
    });

    describe('adjustScenarioDayTimeCron', () => {
        it('should adjust cron to sunrise time', () => {
            const source: ScenarioCronTriggerSource = {
                type: ScenarioTriggerSourceType.Cron,
                cron: '0 0 * * *',
                adjustTo: ScenarioCronTimeAdjustOption.Sunrise,
            };

            const result = service.adjustScenarioDayTimeCron(source);

            expect(result).toBe('30 6 * * *');
        });

        it('should adjust cron to sunset time', () => {
            const source: ScenarioCronTriggerSource = {
                type: ScenarioTriggerSourceType.Cron,
                cron: '0 0 * * *',
                adjustTo: ScenarioCronTimeAdjustOption.Sunset,
            };

            const result = service.adjustScenarioDayTimeCron(source);

            expect(result).toBe('45 18 * * *');
        });

        it('should handle cron with seconds', () => {
            /* Cron expression with seconds field */
            const source: ScenarioCronTriggerSource = {
                type: ScenarioTriggerSourceType.Cron,
                cron: '0 0 0 * * *',
                adjustTo: ScenarioCronTimeAdjustOption.Sunrise,
            };

            const result = service.adjustScenarioDayTimeCron(source);

            expect(result).toBe('30 6 * * *');
        });

        it('should preserve day/month/weekday parts of cron', () => {
            const source: ScenarioCronTriggerSource = {
                type: ScenarioTriggerSourceType.Cron,
                cron: '0 0 1 6 MON',
                adjustTo: ScenarioCronTimeAdjustOption.Sunrise,
            };

            const result = service.adjustScenarioDayTimeCron(source);

            expect(result).toBe('30 6 1 6 MON');
        });
    });

    describe('handleDayTimeAdjustments', () => {
        it('should update scenarios with adjustable time triggers', async () => {
            const mockScenario = {
                externalId: 'scenario-1',
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Cron,
                            cron: '0 0 * * *',
                            adjustTo: ScenarioCronTimeAdjustOption.Sunrise,
                        },
                    ],
                    logic: '1',
                },
            };
            mockScenariosService.getScenariosWithAdjustableTime.mockResolvedValue([mockScenario]);

            await service['handleDayTimeAdjustments']();

            expect(mockScenariosService.getScenariosWithAdjustableTime).toHaveBeenCalled();
            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', {
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Cron,
                            cron: '30 6 * * *',
                            adjustTo: ScenarioCronTimeAdjustOption.Sunrise,
                        },
                    ],
                    logic: '1',
                },
            });
        });

        it('should handle errors gracefully', async () => {
            mockScenariosService.getScenariosWithAdjustableTime.mockRejectedValue(new Error('Database error'));

            await expect(service['handleDayTimeAdjustments']()).resolves.not.toThrow();
        });

        it('should not modify device trigger sources', async () => {
            const mockScenario = {
                externalId: 'scenario-1',
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: 'device-1' },
                        },
                        {
                            type: ScenarioTriggerSourceType.Cron,
                            cron: '0 0 * * *',
                            adjustTo: ScenarioCronTimeAdjustOption.Sunset,
                        },
                    ],
                    logic: '1 AND 2',
                },
            };
            mockScenariosService.getScenariosWithAdjustableTime.mockResolvedValue([mockScenario]);

            await service['handleDayTimeAdjustments']();

            expect(mockScenariosService.updateScenario).toHaveBeenCalledWith('scenario-1', {
                trigger: {
                    sources: [
                        {
                            type: ScenarioTriggerSourceType.Device,
                            device: { externalId: 'device-1' },
                        },
                        {
                            type: ScenarioTriggerSourceType.Cron,
                            cron: '45 18 * * *',
                            adjustTo: ScenarioCronTimeAdjustOption.Sunset,
                        },
                    ],
                    logic: '1 AND 2',
                },
            });
        });
    });
});
