export interface PublicOptions {
    // Restricts the endpoint to the local network, so that a hub exposed to the internet
    // cannot have its unauthenticated endpoints abused (e.g. registration request spam)
    localOnly?: boolean;
}
