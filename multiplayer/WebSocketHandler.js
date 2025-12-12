/**
 * WebSocket Handler for 8-Ball Pool Multiplayer
 * Handles all real-time game communication
 */

const { RoomManager } = require('./RoomManager');
const { MatchmakingQueue, EloCalculator } = require('./MatchmakingQueue');
const { MatchHistory } = require('./MatchHistory');
const { AchievementManager } = require('./Achievements');

class MultiplayerServer {
    constructor(io, users) {
        this.io = io;
        this.users = users; // Reference to user database
        this.roomManager = new RoomManager();
        this.matchmaking = new MatchmakingQueue(this.roomManager);
        this.matchHistory = new MatchHistory();
        this.achievements = new AchievementManager();
        this.connectedPlayers = new Map(); // socketId -> playerData

        this.setupSocketHandlers();
        this.startBackgroundTasks();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🎱 Player connected: ${socket.id}`);

            // Auth events
            socket.on('authenticate', (data) => this.handleAuthenticate(socket, data));

            // Room events
            socket.on('create_room', (data) => this.handleCreateRoom(socket, data));
            socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
            socket.on('leave_room', () => this.handleLeaveRoom(socket));
            socket.on('spectate_room', (data) => this.handleSpectate(socket, data));
            socket.on('get_rooms', () => this.handleGetRooms(socket));
            socket.on('get_active_games', () => this.handleGetActiveGames(socket));

            // Matchmaking events
            socket.on('find_match', (data) => this.handleFindMatch(socket, data));
            socket.on('cancel_matchmaking', () => this.handleCancelMatchmaking(socket));
            socket.on('get_queue_status', () => this.handleGetQueueStatus(socket));

            // Game events
            socket.on('ready', () => this.handleReady(socket));
            socket.on('aim_update', (data) => this.handleAimUpdate(socket, data));
            socket.on('take_shot', (data) => this.handleTakeShot(socket, data));
            socket.on('shot_result', (data) => this.handleShotResult(socket, data));
            socket.on('cue_ball_placed', (data) => this.handleCueBallPlaced(socket, data));
            socket.on('request_rematch', () => this.handleRematchRequest(socket));
            socket.on('accept_rematch', () => this.handleRematchAccept(socket));

            // Chat events
            socket.on('chat_message', (data) => this.handleChatMessage(socket, data));
            socket.on('quick_chat', (data) => this.handleQuickChat(socket, data));

            // Social events
            socket.on('get_leaderboard', (data) => this.handleGetLeaderboard(socket, data));
            socket.on('get_match_history', (data) => this.handleGetMatchHistory(socket, data));
            socket.on('get_achievements', () => this.handleGetAchievements(socket));

            // Disconnect
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    // === Authentication ===
    handleAuthenticate(socket, data) {
        const { token, user } = data;
        if (!user) {
            socket.emit('auth_error', { error: 'Invalid authentication' });
            return;
        }

        // Store player data
        this.connectedPlayers.set(socket.id, {
            id: socket.id,
            oderId: user.id,
            username: user.username,
            email: user.email,
            elo: user.elo || 1200,
            coins: user.coins || 1000
        });

        socket.emit('authenticated', {
            success: true,
            playerId: socket.id,
            stats: this.roomManager.getStats(),
            queueStats: this.matchmaking.getQueueStats()
        });

        console.log(`🔐 Player authenticated: ${user.username}`);
    }

    // === Room Management ===
    handleCreateRoom(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const wager = data?.wager || 50;

        // Check if player has enough coins
        if (player.coins < wager) {
            socket.emit('room_error', { error: 'Insufficient coins' });
            return;
        }

        const room = this.roomManager.createRoom(player, wager);
        socket.join(room.id);

        socket.emit('room_created', {
            roomId: room.id,
            room: room.toJSON()
        });

        console.log(`🏠 Room created: ${room.id} by ${player.username}`);
    }

    handleJoinRoom(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const { roomId } = data;
        const result = this.roomManager.joinRoom(roomId, player);

        if (result.error) {
            socket.emit('room_error', { error: result.error });
            return;
        }

        const room = result.room;

        // Check if player has enough coins
        if (player.coins < room.wager) {
            this.roomManager.leaveRoom(player.id);
            socket.emit('room_error', { error: 'Insufficient coins' });
            return;
        }

        socket.join(room.id);

        // Notify both players
        this.io.to(room.id).emit('player_joined', {
            roomId: room.id,
            room: room.toJSON()
        });

        console.log(`👤 ${player.username} joined room ${roomId}`);
    }

    handleSpectate(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const { roomId } = data;
        const result = this.roomManager.spectateRoom(roomId, player);

        if (result.error) {
            socket.emit('spectate_error', { error: result.error });
            return;
        }

        socket.join(roomId);
        socket.emit('spectating', {
            roomId,
            room: result.room.toJSON()
        });

        // Notify room
        this.io.to(roomId).emit('spectator_joined', {
            username: player.username,
            count: result.room.spectators.length
        });
    }

    handleLeaveRoom(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.leaveRoom(player.id);
        if (room) {
            socket.leave(room.id);

            // Notify remaining players
            if (room.status === 'finished') {
                this.io.to(room.id).emit('opponent_disconnected', {
                    winner: room.winner,
                    reason: 'forfeit'
                });
            } else {
                this.io.to(room.id).emit('player_left', {
                    playerId: player.id,
                    room: room.toJSON()
                });
            }
        }
    }

    handleGetRooms(socket) {
        const rooms = this.roomManager.getAvailableRooms();
        socket.emit('rooms_list', { rooms });
    }

    handleGetActiveGames(socket) {
        const games = this.roomManager.getActiveGames();
        socket.emit('active_games', { games });
    }

    // === Matchmaking ===
    handleFindMatch(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }

        const tier = data?.tier || 'casual';
        const result = this.matchmaking.addPlayer(player, tier);

        if (result.error) {
            socket.emit('matchmaking_error', { error: result.error });
            return;
        }

        if (result.matched) {
            // Match found!
            const room = this.roomManager.getRoom(result.roomId);

            // Join both players to room
            socket.join(result.roomId);
            console.log(`📌 Socket ${socket.id} (${player.username}) joined room ${result.roomId}`);

            // Find opponent socket
            const opponentSocketId = result.opponent.id;
            const opponentSocket = this.io.sockets.sockets.get(opponentSocketId);
            if (opponentSocket) {
                opponentSocket.join(result.roomId);
                console.log(`📌 Socket ${opponentSocketId} (${result.opponent.username}) joined room ${result.roomId}`);
            } else {
                console.error(`❌ Could not find opponent socket: ${opponentSocketId}`);
            }

            // Verify room members
            const roomSockets = this.io.sockets.adapter.rooms.get(result.roomId);
            console.log(`📊 Room ${result.roomId} has ${roomSockets ? roomSockets.size : 0} members:`, roomSockets ? [...roomSockets] : []);

            // Notify both players
            this.io.to(result.roomId).emit('match_found', {
                roomId: result.roomId,
                room: room.toJSON(),
                wager: result.wager,
                tier: result.tier
            });

            console.log(`⚡ Match found: ${player.username} vs ${result.opponent.username}`);

            // AUTO-START: Start game automatically after 2 seconds
            setTimeout(() => {
                const currentRoom = this.roomManager.getRoom(result.roomId);
                if (currentRoom && (currentRoom.status === 'ready' || currentRoom.status === 'waiting')) {
                    const gameState = currentRoom.startGame();

                    this.io.to(result.roomId).emit('game_start', {
                        roomId: currentRoom.id,
                        gameState,
                        currentPlayer: 1,
                        host: currentRoom.host,
                        guest: currentRoom.guest,
                        wager: currentRoom.wager
                    });

                    console.log(`🎮 Game auto-started in room ${currentRoom.id}`);
                }
            }, 2000);
        } else {
            socket.emit('matchmaking_started', {
                position: result.position,
                tier: result.tier,
                estimatedWait: result.estimatedWait
            });

            console.log(`🔍 ${player.username} searching for match...`);
        }
    }

    handleCancelMatchmaking(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const removed = this.matchmaking.removePlayer(player.id);
        socket.emit('matchmaking_cancelled', { success: removed });
    }

    handleGetQueueStatus(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const status = this.matchmaking.getPlayerStatus(player.id);
        socket.emit('queue_status', status || { inQueue: false });
    }

    // === Game Events ===
    handleReady(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'ready') return;

        // Start the game
        const gameState = room.startGame();

        this.io.to(room.id).emit('game_start', {
            roomId: room.id,
            gameState,
            currentPlayer: 1,
            host: room.host,
            guest: room.guest,
            wager: room.wager
        });

        console.log(`🎮 Game started in room ${room.id}`);
    }

    handleAimUpdate(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') return;

        // Broadcast aim to opponent and spectators
        socket.to(room.id).emit('opponent_aim', {
            angle: data.angle,
            power: data.power,
            spinX: data.spinX,
            spinY: data.spinY
        });
    }

    handleTakeShot(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) {
            console.log(`❌ take_shot: No player found for socket ${socket.id}`);
            return;
        }

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') {
            console.log(`❌ take_shot: No room or wrong status - room: ${room?.id}, status: ${room?.status}`);
            return;
        }

        console.log(`🎯 take_shot from ${player.username} in room ${room.id}`);
        const playerNum = room.getPlayerNumber(player.id);
        console.log(`   - Player Number: ${playerNum} (ID: ${player.id})`);

        const result = room.processShot(player.id, data);

        if (result.error) {
            console.log(`❌ Shot error: ${result.error}`);
            socket.emit('shot_error', { error: result.error });
            return;
        }

        // Broadcast shot to all in room
        const roomSockets = this.io.sockets.adapter.rooms.get(room.id);
        const socketsInRoom = roomSockets ? [...roomSockets] : [];
        console.log(`📊 Broadcasting shot to room ${room.id} (Individual Send)`);

        const shotData = {
            player: room.getPlayerNumber(player.id),
            shot: result.shot
        };

        // Send to each socket in room individually to ensure delivery
        for (const socketId of socketsInRoom) {
            const targetSocket = this.io.sockets.sockets.get(socketId);
            if (targetSocket) {
                console.log(`   📤 Sending shot_taken to socket ${socketId}`);
                targetSocket.emit('shot_taken', shotData);
            } else {
                console.log(`   ⚠️ Socket ${socketId} not found!`);
            }
        }
    }

    handleShotResult(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'playing') return;

        // Accept results from the player who just shot (current player)
        const playerNum = room.getPlayerNumber(player.id);
        if (playerNum !== room.gameState.currentPlayer) {
            console.log(`⚠️ Ignoring shot_result from player ${playerNum}, expected from ${room.gameState.currentPlayer}`);
            return;
        }

        console.log(`📊 Processing shot result from Player ${playerNum}`);

        // Update ball positions
        if (data.balls) {
            room.updateBallPositions(data.balls);
        }

        // Process shot result (this will handle turn switching)
        const result = room.handleShotResult(data);

        if (result.gameOver) {
            // Broadcast game over to all players
            this.io.to(room.id).emit('game_state_update', {
                gameState: room.gameState,
                balls: data.balls,
                gameOver: true,
                winner: result.winner,
                reason: result.reason
            });
            this.handleGameOver(room, result);
        } else {
            // Broadcast game state update with ball positions
            console.log(`📤 Broadcasting game state: Current Player = ${room.gameState.currentPlayer}`);
            this.io.to(room.id).emit('game_state_update', {
                gameState: room.gameState,
                balls: data.balls,  // Send ball positions at top level for easy access
                lastResult: data
            });
        }
    }

    handleCueBallPlaced(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || !room.gameState.ballInHand) return;

        // Validate it's this player's turn
        if (room.getPlayerNumber(player.id) !== room.gameState.currentPlayer) return;

        room.placeCueBall(data.x, data.y);

        this.io.to(room.id).emit('cue_ball_placed', {
            x: data.x,
            y: data.y,
            player: room.getPlayerNumber(player.id)
        });
    }

    handleGameOver(room, result) {
        const winnerNum = result.winner;
        const winner = winnerNum === 1 ? room.host : room.guest;
        const loser = winnerNum === 1 ? room.guest : room.host;

        // Calculate ELO changes
        const eloResult = EloCalculator.calculateNewRatings(
            winner.elo || 1200,
            loser.elo || 1200
        );

        // Update player ELO and coins in memory
        winner.elo = eloResult.winner.newElo;
        winner.coins = (winner.coins || 1000) + room.wager;
        loser.elo = eloResult.loser.newElo;
        loser.coins = Math.max(0, (loser.coins || 1000) - room.wager);

        // Update in user database
        this.updateUserStats(winner, loser, room.wager, eloResult);

        // Save match history
        const matchRecord = this.matchHistory.recordMatch({
            roomId: room.id,
            host: room.host,
            guest: room.guest,
            winner: winnerNum,
            reason: result.reason || '8ball',
            wager: room.wager,
            eloChanges: eloResult,
            shotHistory: room.gameState.shotHistory,
            duration: Date.now() - room.createdAt
        });

        // Check achievements
        const winnerAchievements = this.achievements.checkAchievements(winner, matchRecord, true);
        const loserAchievements = this.achievements.checkAchievements(loser, matchRecord, false);

        // Emit game over
        this.io.to(room.id).emit('game_over', {
            winner: winnerNum,
            winnerName: winner.username,
            reason: result.reason,
            wager: room.wager,
            eloChanges: eloResult,
            matchId: matchRecord.id,
            achievements: {
                winner: winnerAchievements,
                loser: loserAchievements
            }
        });

        console.log(`🏆 Game over in room ${room.id}: ${winner.username} wins!`);
    }

    updateUserStats(winner, loser, wager, eloResult) {
        // Update winner stats
        if (this.users.has(winner.email)) {
            const user = this.users.get(winner.email);
            user.elo = eloResult.winner.newElo;
            user.coins += wager;
            user.gamesPlayed++;
            user.gamesWon++;
        }

        // Update loser stats
        if (this.users.has(loser.email)) {
            const user = this.users.get(loser.email);
            user.elo = eloResult.loser.newElo;
            user.coins = Math.max(0, user.coins - wager);
            user.gamesPlayed++;
        }
    }

    // === Chat ===
    handleChatMessage(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room) return;

        // Sanitize message
        const message = String(data.message || '').slice(0, 200);
        if (!message.trim()) return;

        this.io.to(room.id).emit('chat_message', {
            from: player.username,
            playerId: socket.id,
            message,
            timestamp: Date.now()
        });
    }

    handleQuickChat(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room) return;

        const quickMessages = [
            'Good luck!', 'Nice shot!', 'Oops!', 'Well played!',
            'Your turn!', 'GG', 'Wow!', 'Thanks!'
        ];

        const message = quickMessages[data.messageId] || data.message;
        if (!message) return;

        this.io.to(room.id).emit('quick_chat', {
            from: player.username,
            playerId: socket.id,
            message,
            messageId: data.messageId
        });
    }

    // === Rematch ===
    handleRematchRequest(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'finished') return;

        socket.to(room.id).emit('rematch_requested', {
            from: player.username
        });
    }

    handleRematchAccept(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.getPlayerRoom(player.id);
        if (!room || room.status !== 'finished') return;

        // Start new game
        const gameState = room.startGame();

        this.io.to(room.id).emit('game_start', {
            roomId: room.id,
            gameState,
            currentPlayer: 1,
            host: room.host,
            guest: room.guest,
            wager: room.wager,
            rematch: true
        });
    }

    // === Social ===
    handleGetLeaderboard(socket, data) {
        const type = data?.type || 'elo';
        const limit = Math.min(data?.limit || 20, 100);

        // Get leaderboard from users
        const players = Array.from(this.users.values())
            .filter(u => u.gamesPlayed > 0)
            .sort((a, b) => {
                if (type === 'wins') return (b.gamesWon || 0) - (a.gamesWon || 0);
                if (type === 'winrate') {
                    const aRate = a.gamesPlayed ? a.gamesWon / a.gamesPlayed : 0;
                    const bRate = b.gamesPlayed ? b.gamesWon / b.gamesPlayed : 0;
                    return bRate - aRate;
                }
                return (b.elo || 1200) - (a.elo || 1200);
            })
            .slice(0, limit)
            .map((u, i) => ({
                rank: i + 1,
                username: u.username,
                elo: u.elo || 1200,
                wins: u.gamesWon || 0,
                games: u.gamesPlayed || 0,
                rankInfo: EloCalculator.getRankFromElo(u.elo || 1200)
            }));

        socket.emit('leaderboard', { type, players });
    }

    handleGetMatchHistory(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const history = this.matchHistory.getPlayerHistory(player.userId || player.email, data?.limit);
        socket.emit('match_history', { matches: history });
    }

    handleGetAchievements(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const achievements = this.achievements.getPlayerAchievements(player.userId || player.email);
        socket.emit('achievements', achievements);
    }

    // === Disconnect ===
    handleDisconnect(socket) {
        const player = this.connectedPlayers.get(socket.id);

        if (player) {
            // Remove from matchmaking
            this.matchmaking.removePlayer(player.id);

            // Handle leaving room
            this.handleLeaveRoom(socket);

            // Remove from connected players
            this.connectedPlayers.delete(socket.id);

            console.log(`👋 Player disconnected: ${player.username}`);
        } else {
            console.log(`👋 Unknown socket disconnected: ${socket.id}`);
        }
    }

    // === Background Tasks ===
    startBackgroundTasks() {
        // Process matchmaking queues every 2 seconds
        setInterval(() => {
            ['casual', 'competitive', 'highStakes'].forEach(tier => {
                const result = this.matchmaking.processQueue(tier);
                if (result?.matched) {
                    const room = this.roomManager.getRoom(result.roomId);
                    if (room) {
                        // Notify matched players
                        this.io.to(result.roomId).emit('match_found', {
                            roomId: result.roomId,
                            room: room.toJSON()
                        });
                    }
                } else if (result?.timeout) {
                    // Notify player of timeout
                    const socket = this.io.sockets.sockets.get(result.playerId);
                    if (socket) {
                        socket.emit('matchmaking_timeout', {
                            message: 'No match found. Please try again.'
                        });
                    }
                }
            });
        }, 2000);

        // Cleanup old rooms every 5 minutes
        setInterval(() => {
            this.roomManager.cleanupOldRooms();
        }, 5 * 60 * 1000);

        // Broadcast stats every 10 seconds
        setInterval(() => {
            this.io.emit('server_stats', {
                rooms: this.roomManager.getStats(),
                queue: this.matchmaking.getQueueStats(),
                online: this.connectedPlayers.size
            });
        }, 10000);
    }

    getStats() {
        return {
            connectedPlayers: this.connectedPlayers.size,
            rooms: this.roomManager.getStats(),
            matchmaking: this.matchmaking.getQueueStats()
        };
    }
}

module.exports = { MultiplayerServer };
