import { Scenario } from 'scenarios/interfaces';
import { RecordsPage } from 'common/interfaces';

export interface ScenariosPage extends RecordsPage {
    scenarios: Array<Scenario>;
}
