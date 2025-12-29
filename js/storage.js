/**
 * IndexedDB Storage Manager
 * Handles all database operations for the referral system
 */

class StorageManager {
    constructor() {
        this.dbName = 'ReferralSystemDB';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Users object store
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('username', 'username', { unique: true });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('referralCode', 'referralCode', { unique: true });
                    userStore.createIndex('referredBy', 'referredBy', { unique: false });
                }

                // Referrals object store
                if (!db.objectStoreNames.contains('referrals')) {
                    const refStore = db.createObjectStore('referrals', { keyPath: 'id' });
                    refStore.createIndex('referrerId', 'referrerId', { unique: false });
                    refStore.createIndex('referredId', 'referredId', { unique: false });
                }
            };
        });
    }

    /**
     * Add a new user to the database
     */
    async addUser(user) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.add(user);

            request.onsuccess = () => resolve(user);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get user by ID
     */
    async getUserById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('username');
            const request = index.get(username);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('email');
            const request = index.get(email);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get user by referral code
     */
    async getUserByReferralCode(code) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('referralCode');
            const request = index.get(code);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update user data
     */
    async updateUser(user) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);

            request.onsuccess = () => resolve(user);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all users
     */
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add a referral relationship
     */
    async addReferral(referral) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['referrals'], 'readwrite');
            const store = transaction.objectStore('referrals');
            const request = store.add(referral);

            request.onsuccess = () => resolve(referral);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all referrals for a user (where they are the referrer)
     */
    async getReferralsByReferrer(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['referrals'], 'readonly');
            const store = transaction.objectStore('referrals');
            const index = store.index('referrerId');
            const request = index.getAll(userId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all referrals
     */
    async getAllReferrals() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['referrals'], 'readonly');
            const store = transaction.objectStore('referrals');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete user by ID
     */
    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users', 'referrals'], 'readwrite');

            const userStore = transaction.objectStore('users');
            const refStore = transaction.objectStore('referrals');

            userStore.clear();
            refStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Export all data as JSON
     */
    async exportData() {
        const users = await this.getAllUsers();
        const referrals = await this.getAllReferrals();

        return {
            users,
            referrals,
            exportedAt: new Date().toISOString()
        };
    }
}

// Export singleton instance
const storage = new StorageManager();
