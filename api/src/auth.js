import { SignJWT, jwtVerify } from "jose";
export async function signToken(payload, secret) {
    const secretKey = new TextEncoder().encode(secret);
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("365d") // Token expires in 365 days
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
       return compareHashes(a, b);
    }

    return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

async function compareHashes(a, b) {
    const enc = new TextEncoder();
    const aHash = await crypto.subtle.digest("SHA-256", enc.encode(a));
    const bHash = await crypto.subtle.digest("SHA-256", enc.encode(b));
    return crypto.subtle.timingSafeEqual(aHash, bHash);
}

/**
 * Hash a password with a salt using SHA-256.
 * Format: hex(SHA-256(salt + ":" + password))
 * @param {string} password
 * @param {string} salt - crypto.randomUUID()
 * @returns {Promise<string>} hex hash
 */
export async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Verify a sub-admin password against a stored hash and salt.
 * @param {string} inputPassword - The user-provided password
 * @param {string} storedHash - The hex SHA-256 hash stored in DB
 * @param {string} storedSalt - The UUID salt stored in DB
 * @returns {Promise<boolean>}
 */
export async function verifySubAdminPassword(inputPassword, storedHash, storedSalt) {
    if (!inputPassword || !storedHash || !storedSalt) return false;
    const computedHash = await hashPassword(inputPassword, storedSalt);
    // Constant-time compare the hex strings
    const enc = new TextEncoder();
    const a = enc.encode(computedHash);
    const b = enc.encode(storedHash);
    if (a.length !== b.length) return false;
    return crypto.subtle.timingSafeEqual(a, b);
}
