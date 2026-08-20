export interface GoogleProfile {
    /**
     * SHA-256 hash of the "sub" claim of the Google ID token - a stable, unique identifier of the Google account.
     *
     * Only the hash leaves the verifier, so the account identifiers are never stored nor logged as is
     */
    googleIdHash: string;
    email: string;
    name?: string;
}
