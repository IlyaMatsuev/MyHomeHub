// Renames the "devices" array on scenarios to "actions".
// The field never held devices - it holds the controls/measurements each scenario writes on execution,
// so "actions" describes it correctly and matches the ScenarioAction interface/DTO.

const conflicting = db.scenarios.countDocuments({ devices: { $exists: true }, actions: { $exists: true } });
if (conflicting > 0) {
    throw new Error(`${conflicting} scenario(s) have both "devices" and "actions" - resolve them manually before running this migration`);
}

const result = db.scenarios.updateMany({ devices: { $exists: true } }, { $rename: { devices: 'actions' } });
print(`Renamed "devices" to "actions" on ${result.modifiedCount} scenario(s).`);
