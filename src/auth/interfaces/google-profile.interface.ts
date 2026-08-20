export interface GoogleProfile {
    /** The "sub" claim of the Google ID token - a stable, unique identifier of the Google account */
    googleId: string;
    email: string;
    name?: string;
}
