import { PairableDevice } from 'zigbee/interfaces';
import { RecordsPage } from 'common/interfaces';

export interface PairableDevicesPage extends RecordsPage {
    devices: Array<PairableDevice>;
}
