import { Device } from 'devices/interfaces';
import { RecordsPage } from 'common/interfaces';

export interface DevicesPage extends RecordsPage {
    devices: Array<Device>;
}
