/**
 * Authentication and Session Management
 */

class AuthManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.sessionKey = 'referralSystem_session';
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a unique referral code (8 characters, alphanumeric uppercase)
     */
    async generateReferralCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;

        while (!isUnique) {
            code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // Check if code already exists
            const existingUser = await this.storage.getUserByReferralCode(code);
            if (!existingUser) {
                isUnique = true;
            }
        }

        return code;
    }

    /**
     * Hash password using Web Crypto API
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Register a new user
     */
    async register(username, email, password, referralCode = null) {
        try {
            // Validate inputs
            if (!username || username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }
            if (!email || !email.includes('@')) {
                throw new Error('Invalid email address');
            }
            if (!password || password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            // Check if username already exists
            const existingUsername = await this.storage.getUserByUsername(username);
            if (existingUsername) {
                throw new Error('Username already exists');
            }

            // Check if email already exists
            const existingEmail = await this.storage.getUserByEmail(email);
            if (existingEmail) {
                throw new Error('Email already exists');
            }

            // Validate referral code if provided
            let referredBy = null;
            if (referralCode && referralCode.trim() !== '') {
                const referrer = await this.storage.getUserByReferralCode(referralCode.toUpperCase());
                if (!referrer) {
                    throw new Error('Invalid referral code');
                }
                referredBy = referralCode.toUpperCase();
            }

            // Create new user
            const user = {
                id: this.generateId(),
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                passwordHash: await this.hashPassword(password),
                referralCode: await this.generateReferralCode(),
                referredBy: referredBy,
                isAdmin: false,
                createdAt: Date.now(),
                totalEarnings: 0,
                earningsByLevel: {
                    level1: 0,
                    level2: 0,
                    level3: 0,
                    level4Plus: 0
                }
            };

            // Add user to database
            await this.storage.addUser(user);

            // If user was referred, process the referral
            if (referredBy) {
                await window.referralSystem.processNewReferral(user.id, referredBy);
            }

            return {
                success: true,
                user: this.sanitizeUser(user)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Login user
     */
    async login(username, password) {
        try {
            // Get user
            const user = await this.storage.getUserByUsername(username.toLowerCase());
            if (!user) {
                throw new Error('Invalid username or password');
            }

            // Verify password
            const hashedPassword = await this.hashPassword(password);
            if (hashedPassword !== user.passwordHash) {
                throw new Error('Invalid username or password');
            }

            // Create session
            this.setSession(user);

            return {
                success: true,
                user: this.sanitizeUser(user)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem(this.sessionKey);
        window.location.href = 'index.html';
    }

    /**
     * Set current session
     */
    setSession(user) {
        const session = {
            userId: user.id,
            username: user.username,
            isAdmin: user.isAdmin,
            timestamp: Date.now()
        };
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
    }

    /**
     * Get current session
     */
    getSession() {
        const sessionData = localStorage.getItem(this.sessionKey);
        if (!sessionData) return null;

        try {
            const session = JSON.parse(sessionData);

            // Check if session is expired (24 hours)
            const expiryTime = 24 * 60 * 60 * 1000;
            if (Date.now() - session.timestamp > expiryTime) {
                this.logout();
                return null;
            }

            return session;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get current user data
     */
    async getCurrentUser() {
        const session = this.getSession();
        if (!session) return null;

        return await this.storage.getUserById(session.userId);
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.getSession() !== null;
    }

    /**
     * Check if current user is admin
     */
    isAdmin() {
        const session = this.getSession();
        return session && session.isAdmin;
    }

    /**
     * Remove sensitive data from user object
     */
    sanitizeUser(user) {
        const { passwordHash, ...sanitized } = user;
        return sanitized;
    }

    /**
     * Create first admin user (for initial setup)
     */
    async createAdminUser(username, email, password) {
        const user = {
            id: this.generateId(),
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            passwordHash: await this.hashPassword(password),
            referralCode: await this.generateReferralCode(),
            referredBy: null,
            isAdmin: true,
            createdAt: Date.now(),
            totalEarnings: 0,
            earningsByLevel: {
                level1: 0,
                level2: 0,
                level3: 0,
                level4Plus: 0
            }
        };

        await this.storage.addUser(user);
        return user;
    }
}

// Export (will be initialized in main app)
