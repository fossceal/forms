import { SignJWT, jwtVerify } from "jose";

// Secret for signing tokens. In production, this should be a long, random string from env.SECRET_KEY
// For now we will rely on env.SECRET which we expect to be available.
// If not available, we can fallback or throw (better for security to throw).

export async function signToken(payload, secret) {
    const secretKey = new TextEncoder().encode(secret);
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h") // Token expires in 24 hours
        .sign(secretKey);
}

export async function verifyToken(token, secret) {
    try {
        const secretKey = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
    } catch (error) {
        return null; // Invalid token
    }
}

/**
 * Constant-time comparison for passwords preventing timing attacks.
 * @param {string} a - The user-provided password
 * @param {string} b - The correct password (stored in env)
 * @returns {boolean}
 */
export async function checkPassword(a, b) {
    if (!a || !b) return false;
    const enc = new TextEncoder();
    const aBuf = enc.encode(a);
    const bBuf = enc.encode(b);

    if (aBuf.length !== bBuf.length) {
        // To prevent timing leaks on length we could continue comparing with a dummy,
        // but `crypto.subtle.timingSafeEqual` requires equal lengths.
        // We return false early but strict constant time would hash both first.
        // For our purpose of admin auth, simple timingSafeEqual on hash or strict length check is usually okay
        // provided we don't leak immediately.
        // A better approach for variable length is to hash both input and secret then compare hashes.
        return compareHashes(a, b);
    }

    return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

async function compareHashes(a, b) {
    const enc = new TextEncoder();
    // Hash both to ensure fixed length for comparison
    const aHash = await crypto.subtle.digest("SHA-256", enc.encode(a));
    const bHash = await crypto.subtle.digest("SHA-256", enc.encode(b));
    return crypto.subtle.timingSafeEqual(aHash, bHash);
}
