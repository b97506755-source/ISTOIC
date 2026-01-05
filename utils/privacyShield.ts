
/**
 * PRIVACY SHIELD PROTOCOL v1.0
 * blocks geolocation access at the browser level.
 */

export const activatePrivacyShield = () => {
    try {
        if (!navigator.geolocation) return;

        // Create a dummy geolocation object that denies everything
        const noop = () => {};
        const deny = (success: any, error: any) => {
            console.warn("[PRIVACY_SHIELD] Location request intercepted and blocked.");
            if (error && typeof error === 'function') {
                error({
                    code: 1, // PERMISSION_DENIED
                    message: "Location access blocked by Privacy Shield Protocol.",
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            }
        };

        // Attempt to override the navigator.geolocation property
        try {
            Object.defineProperty(navigator, 'geolocation', {
                value: {
                    getCurrentPosition: deny,
                    watchPosition: (s: any, e: any) => { deny(s, e); return 0; },
                    clearWatch: noop
                },
                configurable: false,
                writable: false
            });
        } catch (e) {
            // Fallback for older browsers or strict environments
            (navigator as any).geolocation.getCurrentPosition = deny;
            (navigator as any).geolocation.watchPosition = (s: any, e: any) => { deny(s, e); return 0; };
        }

        console.log("%c[PRIVACY SHIELD] GEOLOCATION FIREWALL ACTIVE", "background: #000; color: #0f0; padding: 4px; font-weight: bold;");

    } catch (e) {
        console.error("[PRIVACY SHIELD] Initialization failed:", e);
    }
};
