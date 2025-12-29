/**
 * Referral System - Core Logic
 * Handles referral tree structure and earnings calculation
 */

class ReferralSystem {
    constructor(storageManager) {
        this.storage = storageManager;
        this.rewardStructure = {
            level1: 100,
            level2: 60,
            level3: 40,
            level4Plus: 20
        };
    }

    /**
     * Generate a unique referral ID
     */
    generateReferralId() {
        return 'ref_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Process a new referral and distribute earnings
     */
    async processNewReferral(newUserId, referralCode) {
        try {
            // Get the new user
            const newUser = await this.storage.getUserById(newUserId);
            if (!newUser) {
                throw new Error('User not found');
            }

            // Get the direct referrer (Level 1)
            const level1Referrer = await this.storage.getUserByReferralCode(referralCode);
            if (!level1Referrer) {
                throw new Error('Referrer not found');
            }

            // Award Level 1 earnings
            await this.awardEarnings(level1Referrer.id, newUserId, 1, this.rewardStructure.level1);

            // Get Level 2 referrer
            if (level1Referrer.referredBy) {
                const level2Referrer = await this.storage.getUserByReferralCode(level1Referrer.referredBy);
                if (level2Referrer) {
                    await this.awardEarnings(level2Referrer.id, newUserId, 2, this.rewardStructure.level2);

                    // Get Level 3 referrer
                    if (level2Referrer.referredBy) {
                        const level3Referrer = await this.storage.getUserByReferralCode(level2Referrer.referredBy);
                        if (level3Referrer) {
                            await this.awardEarnings(level3Referrer.id, newUserId, 3, this.rewardStructure.level3);

                            // Get Level 4+ referrers
                            let currentReferrer = level3Referrer;
                            let level = 4;

                            while (currentReferrer.referredBy) {
                                const nextReferrer = await this.storage.getUserByReferralCode(currentReferrer.referredBy);
                                if (!nextReferrer) break;

                                await this.awardEarnings(nextReferrer.id, newUserId, level, this.rewardStructure.level4Plus);
                                currentReferrer = nextReferrer;
                                level++;
                            }
                        }
                    }
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Error processing referral:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Award earnings to a referrer
     */
    async awardEarnings(referrerId, referredUserId, level, amount) {
        // Get the referrer
        const referrer = await this.storage.getUserById(referrerId);
        if (!referrer) return;

        // Update earnings
        referrer.totalEarnings += amount;

        // Update level-specific earnings
        if (level === 1) {
            referrer.earningsByLevel.level1 += amount;
        } else if (level === 2) {
            referrer.earningsByLevel.level2 += amount;
        } else if (level === 3) {
            referrer.earningsByLevel.level3 += amount;
        } else {
            referrer.earningsByLevel.level4Plus += amount;
        }

        // Save updated referrer
        await this.storage.updateUser(referrer);

        // Create referral record
        const referral = {
            id: this.generateReferralId(),
            referrerId: referrerId,
            referredId: referredUserId,
            level: level,
            earnings: amount,
            createdAt: Date.now()
        };

        await this.storage.addReferral(referral);
    }

    /**
     * Get all direct referrals for a user
     */
    async getDirectReferrals(userId) {
        const user = await this.storage.getUserById(userId);
        if (!user) return [];

        const allUsers = await this.storage.getAllUsers();
        return allUsers.filter(u => u.referredBy === user.referralCode);
    }

    /**
     * Build complete referral tree for a user
     */
    async buildReferralTree(userId) {
        const user = await this.storage.getUserById(userId);
        if (!user) return null;

        const tree = {
            user: user,
            children: []
        };

        const directReferrals = await this.getDirectReferrals(userId);

        for (const referral of directReferrals) {
            const childTree = await this.buildReferralTree(referral.id);
            if (childTree) {
                tree.children.push(childTree);
            }
        }

        return tree;
    }

    /**
     * Get referral statistics for a user
     */
    async getReferralStats(userId) {
        const tree = await this.buildReferralTree(userId);
        if (!tree) return null;

        const stats = {
            directReferrals: 0,
            totalReferrals: 0,
            levels: {}
        };

        const countReferrals = (node, level = 0) => {
            if (level === 1) {
                stats.directReferrals++;
            }

            if (level > 0) {
                stats.totalReferrals++;
                stats.levels[level] = (stats.levels[level] || 0) + 1;
            }

            for (const child of node.children) {
                countReferrals(child, level + 1);
            }
        };

        countReferrals(tree);

        return stats;
    }

    /**
     * Get all users in referral chain (upline)
     */
    async getUpline(userId) {
        const upline = [];
        const user = await this.storage.getUserById(userId);

        if (!user || !user.referredBy) return upline;

        let currentReferrer = await this.storage.getUserByReferralCode(user.referredBy);

        while (currentReferrer) {
            upline.push(currentReferrer);

            if (!currentReferrer.referredBy) break;

            currentReferrer = await this.storage.getUserByReferralCode(currentReferrer.referredBy);
        }

        return upline;
    }

    /**
     * Get earnings breakdown by referral
     */
    async getEarningsBreakdown(userId) {
        const referrals = await this.storage.getReferralsByReferrer(userId);
        const breakdown = [];

        for (const ref of referrals) {
            const referredUser = await this.storage.getUserById(ref.referredId);
            breakdown.push({
                referredUser: referredUser,
                level: ref.level,
                earnings: ref.earnings,
                date: ref.createdAt
            });
        }

        // Sort by date (newest first)
        breakdown.sort((a, b) => b.date - a.date);

        return breakdown;
    }

    /**
     * Calculate total network size starting from a user
     */
    async getNetworkSize(userId) {
        const tree = await this.buildReferralTree(userId);
        if (!tree) return 0;

        const countNodes = (node) => {
            let count = node.children.length;
            for (const child of node.children) {
                count += countNodes(child);
            }
            return count;
        };

        return countNodes(tree);
    }

    /**
     * Get system-wide statistics (admin)
     */
    async getSystemStats() {
        const allUsers = await this.storage.getAllUsers();
        const allReferrals = await this.storage.getAllReferrals();

        const totalEarnings = allUsers.reduce((sum, user) => sum + user.totalEarnings, 0);

        const earningsByLevel = {
            level1: 0,
            level2: 0,
            level3: 0,
            level4Plus: 0
        };

        allUsers.forEach(user => {
            earningsByLevel.level1 += user.earningsByLevel.level1;
            earningsByLevel.level2 += user.earningsByLevel.level2;
            earningsByLevel.level3 += user.earningsByLevel.level3;
            earningsByLevel.level4Plus += user.earningsByLevel.level4Plus;
        });

        // Find top earners
        const topEarners = [...allUsers]
            .sort((a, b) => b.totalEarnings - a.totalEarnings)
            .slice(0, 10)
            .map(user => ({
                username: user.username,
                totalEarnings: user.totalEarnings,
                referralCode: user.referralCode
            }));

        return {
            totalUsers: allUsers.length,
            totalReferrals: allReferrals.length,
            totalEarnings: totalEarnings,
            earningsByLevel: earningsByLevel,
            topEarners: topEarners
        };
    }
}

// Export (will be initialized in main app)
