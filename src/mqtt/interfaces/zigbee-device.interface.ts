export interface ZigbeeDevice {
    ieee_address: string;
    friendly_name: string;
    type: 'Coordinator' | 'Router' | 'EndDevice';
    supported: boolean;
    disabled: boolean;
    interview_completed: boolean;
    interview_state: 'PENDING' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'FAILED';
    definition: {
        model: string;
        vendor: string;
        description: string;
    } | null;
}
