// Ideally these enums need to be available as mongodb documents, so that they can be changed whenever I add a new device type/brand
// However, adding a new type/brand always requires additional development anyway.
// If I want to make it configurable, I need to provide a way of configuring the communication between devices via API instead of code

export enum Room {
    None = 'none',
    Bathroom = 'bathroom',
    Bedroom = 'bedroom',
    Kitchen = 'kitchen',
    LivingRoom = 'living-room',
    Office = 'office',
}

export enum DeviceType {
    Speaker = 'speaker',
    Plug = 'plug',
    Switch = 'switch',
    LED = 'led',
    Fans = 'fans',
    MotionSensor = 'motion-sensor',
    Remote = 'remote',
}

export enum DeviceBrand {
    Google = 'google',
    Shelly = 'shelly',
    Tuya = 'tuya',
    Philips = 'philips',
    ESP32 = 'esp32',
}
