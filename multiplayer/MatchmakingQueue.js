/**
 * Matchmaking Queue for 8-Ball Pool
 * Implements skill-based matchmaking with ELO ratings
 */

class MatchmakingQueue {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.queues = {
            casual: [],      // 50 coins wager
            competitive: [], // 250 coins wager
            highStakes: []   // 1000 coins wager
        };
        this.playerQueues = new Map(); // playerId -> {queue, joinedAt}

        // Matchmaking settings
        this.settings = {
            initialEloRange: 500,     // Starting ELO difference tolerance (raised for easier matching)
            eloRangeExpansion: 100,   // Expand by this much every interval
            expansionInterval: 5000,  // 5 seconds
            maxEloRange: 1000,        // Maximum ELO difference
            maxWaitTime: 120000       // 2 minutes max wait
        };
    }

    addPlayer(player, tier = 'casual') {
        // Check if already in queue
        if (this.playerQueues.has(player.id)) {
            return { error: 'Already in queue', position: this.getPosition(player.id) };
        }

        // Validate tier
        if (!this.queues[tier]) {
            tier = 'casual';
        }

        const queueEntry = {
            id: player.id,
            username: player.username,
            elo: player.elo || 1200,
            coins: player.coins || 1000,
            joinedAt: Date.now()
        };

        this.queues[tier].push(queueEntry);
        this.playerQueues.set(player.id, { queue: tier, joinedAt: Date.now() });

        // Try to find a match immediately
        const match = this.tryMatch(queueEntry, tier);
        if (match.matched) {
            return match;
        }

        return {
            matched: false,
            position: this.queues[tier].length,
            tier,
            estimatedWait: this.estimateWaitTime(tier)
        };
    }

    removePlayer(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return false;

        const tier = playerInfo.queue;
        this.queues[tier] = this.queues[tier].filter(p => p.id !== playerId);
        this.playerQueues.delete(playerId);
        return true;
    }

    tryMatch(player, tier) {
        const queue = this.queues[tier];
        const now = Date.now();

        // Calculate current ELO range based on wait time
        const waitTime = now - player.joinedAt;
        const expansions = Math.floor(waitTime / this.settings.expansionInterval);
        const currentRange = Math.min(
            this.settings.initialEloRange + (expansions * this.settings.eloRangeExpansion),
            this.settings.maxEloRange
        );

        console.log(`🔎 tryMatch for ${player.username}: queue has ${queue.length} players, ELO range: ${currentRange}`);

        // Find best match within ELO range
        let bestMatch = null;
        let bestEloDiff = Infinity;

        for (let i = 0; i < queue.length; i++) {
            const opponent = queue[i];
            if (opponent.id === player.id) continue;

            const eloDiff = Math.abs(player.elo - opponent.elo);
            console.log(`   Checking ${opponent.username}: ELO diff ${eloDiff}, range ${currentRange}`);

            // Check if within range
            if (eloDiff <= currentRange && eloDiff < bestEloDiff) {
                bestMatch = opponent;
                bestEloDiff = eloDiff;
            }
        }

        if (bestMatch) {
            // Match found! Remove both from queue
            this.queues[tier] = queue.filter(p => p.id !== player.id && p.id !== bestMatch.id);
            this.playerQueues.delete(player.id);
            this.playerQueues.delete(bestMatch.id);

            // Determine wager based on tier
            const wagers = { casual: 50, competitive: 250, highStakes: 1000 };
            const wager = wagers[tier] || 50;

            // Create room (let host be the one who waited longer)
            const host = player.joinedAt < bestMatch.joinedAt ? player : bestMatch;
            const guest = player.joinedAt < bestMatch.joinedAt ? bestMatch : player;

            const room = this.roomManager.createRoom(host, wager);
            this.roomManager.joinRoom(room.id, guest);

            return {
                matched: true,
                roomId: room.id,
                opponent: bestMatch,
                wager,
                tier
            };
        }

        return { matched: false };
    }

    // Run periodic matching for players who have been waiting
    processQueue(tier) {
        const queue = this.queues[tier];
        const now = Date.now();

        // Sort by join time (oldest first)
        queue.sort((a, b) => a.joinedAt - b.joinedAt);

        // Process each player
        for (let i = 0; i < queue.length; i++) {
            const player = queue[i];

            // Skip if matched already
            if (!this.playerQueues.has(player.id)) continue;

            // Try to find a match
            const match = this.tryMatch(player, tier);
            if (match.matched) {
                return match;
            }

            // Check for timeout
            if (now - player.joinedAt > this.settings.maxWaitTime) {
                this.removePlayer(player.id);
                return { timeout: true, playerId: player.id };
            }
        }

        return null;
    }

    getPosition(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return -1;

        const queue = this.queues[playerInfo.queue];
        const index = queue.findIndex(p => p.id === playerId);
        return index + 1;
    }

    estimateWaitTime(tier) {
        const queue = this.queues[tier];
        if (queue.length === 0) return 30; // 30 seconds if empty
        if (queue.length === 1) return 15; // Match likely soon
        return Math.max(5, 30 - queue.length * 2); // Less wait with more players
    }

    getQueueStats() {
        return {
            casual: {
                players: this.queues.casual.length,
                avgWait: this.calculateAverageWait('casual')
            },
            competitive: {
                players: this.queues.competitive.length,
                avgWait: this.calculateAverageWait('competitive')
            },
            highStakes: {
                players: this.queues.highStakes.length,
                avgWait: this.calculateAverageWait('highStakes')
            },
            totalPlayers: this.playerQueues.size
        };
    }

    calculateAverageWait(tier) {
        const queue = this.queues[tier];
        if (queue.length === 0) return 0;

        const now = Date.now();
        const totalWait = queue.reduce((sum, p) => sum + (now - p.joinedAt), 0);
        return Math.round(totalWait / queue.length / 1000);
    }

    getPlayerStatus(playerId) {
        const playerInfo = this.playerQueues.get(playerId);
        if (!playerInfo) return null;

        const queue = this.queues[playerInfo.queue];
        const player = queue.find(p => p.id === playerId);
        if (!player) return null;

        const now = Date.now();
        const waitTime = now - player.joinedAt;
        const expansions = Math.floor(waitTime / this.settings.expansionInterval);
        const currentRange = Math.min(
            this.settings.initialEloRange + (expansions * this.settings.eloRangeExpansion),
            this.settings.maxEloRange
        );

        return {
            position: this.getPosition(playerId),
            tier: playerInfo.queue,
            waitTime: Math.round(waitTime / 1000),
            currentEloRange: currentRange,
            playersInQueue: queue.length
        };
    }
}

// ELO calculation helper
class EloCalculator {
    static K_FACTOR = 32; // Standard K-factor

    static calculateExpectedScore(playerElo, opponentElo) {
        return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    }

    static calculateNewRatings(winnerElo, loserElo) {
        const expectedWinner = this.calculateExpectedScore(winnerElo, loserElo);
        const expectedLoser = this.calculateExpectedScore(loserElo, winnerElo);

        const newWinnerElo = Math.round(winnerElo + this.K_FACTOR * (1 - expectedWinner));
        const newLoserElo = Math.round(loserElo + this.K_FACTOR * (0 - expectedLoser));

        return {
            winner: {
                oldElo: winnerElo,
                newElo: newWinnerElo,
                change: newWinnerElo - winnerElo
            },
            loser: {
                oldElo: loserElo,
                newElo: Math.max(100, newLoserElo), // Minimum ELO of 100
                change: newLoserElo - loserElo
            }
        };
    }

    static getRankFromElo(elo) {
        if (elo >= 2400) return { rank: 'Grandmaster', tier: 6, color: '#FF6B6B' };
        if (elo >= 2000) return { rank: 'Master', tier: 5, color: '#C0C0C0' };
        if (elo >= 1700) return { rank: 'Diamond', tier: 4, color: '#00D4FF' };
        if (elo >= 1400) return { rank: 'Platinum', tier: 3, color: '#4ECDC4' };
        if (elo >= 1100) return { rank: 'Gold', tier: 2, color: '#FFD700' };
        if (elo >= 800) return { rank: 'Silver', tier: 1, color: '#A0A0A0' };
        return { rank: 'Bronze', tier: 0, color: '#CD7F32' };
    }
}

module.exports = { MatchmakingQueue, EloCalculator };
