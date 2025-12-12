/**
 * Matchmaking UI for 8-Ball Pool Multiplayer
 * Handles matchmaking screens, room management, and lobby
 */

class MatchmakingUI {
    constructor(network) {
        this.network = network;
        this.isSearching = false;
        this.searchStartTime = null;
        this.timerInterval = null;
        this.selectedTier = 'casual';

        this.tiers = {
            casual: { name: 'Casual', wager: 50, icon: '☕', color: '#4ECDC4' },
            competitive: { name: 'Competitive', wager: 250, icon: '⚔️', color: '#FFD700' },
            highStakes: { name: 'High Stakes', wager: 1000, icon: '💎', color: '#FF6B6B' }
        };

        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.bindNetworkEvents();
    }

    createUI() {
        // Create matchmaking overlay
        const overlay = document.createElement('div');
        overlay.id = 'matchmaking-overlay';
        overlay.className = 'matchmaking-overlay hidden';
        overlay.innerHTML = `
            <div class="matchmaking-modal">
                <div class="matchmaking-header">
                    <h2>🎱 FIND MATCH</h2>
                    <button class="close-btn" id="close-matchmaking">✕</button>
                </div>
                
                <div class="matchmaking-content">
                    <!-- Tier Selection -->
                    <div class="tier-selection" id="tier-selection">
                        <h3>Select Game Mode</h3>
                        <div class="tier-cards">
                            <div class="tier-card selected" data-tier="casual">
                                <span class="tier-icon">☕</span>
                                <span class="tier-name">Casual</span>
                                <span class="tier-wager">50 💰</span>
                            </div>
                            <div class="tier-card" data-tier="competitive">
                                <span class="tier-icon">⚔️</span>
                                <span class="tier-name">Competitive</span>
                                <span class="tier-wager">250 💰</span>
                            </div>
                            <div class="tier-card" data-tier="highStakes">
                                <span class="tier-icon">💎</span>
                                <span class="tier-name">High Stakes</span>
                                <span class="tier-wager">1,000 💰</span>
                            </div>
                        </div>
                        <button class="btn-find-match" id="btn-start-search">
                            <span>🔍 FIND MATCH</span>
                        </button>
                    </div>
                    
                    <!-- Searching State -->
                    <div class="searching-state hidden" id="searching-state">
                        <div class="search-animation">
                            <div class="spinner-ring"></div>
                            <span class="search-icon">🎱</span>
                        </div>
                        <p class="search-text">Searching for opponent...</p>
                        <p class="search-time">Time: <span id="search-timer">0:00</span></p>
                        <p class="search-info" id="search-info"></p>
                        <button class="btn-cancel" id="btn-cancel-search">CANCEL</button>
                    </div>
                    
                    <!-- Match Found State -->
                    <div class="match-found-state hidden" id="match-found-state">
                        <div class="match-found-animation">✨</div>
                        <h3>MATCH FOUND!</h3>
                        <div class="opponent-info" id="opponent-info"></div>
                        <p class="wager-info" id="wager-info"></p>
                        <button class="btn-ready" id="btn-ready">READY!</button>
                    </div>
                </div>
                
                <!-- Room Options -->
                <div class="room-options">
                    <button class="btn-room" id="btn-create-room">
                        <span class="room-icon">🏠</span>
                        <span>Create Room</span>
                    </button>
                    <button class="btn-room" id="btn-join-room">
                        <span class="room-icon">🚪</span>
                        <span>Join Room</span>
                    </button>
                    <button class="btn-room" id="btn-spectate">
                        <span class="room-icon">👀</span>
                        <span>Spectate</span>
                    </button>
                </div>
            </div>
        `;

        // Create room code modal
        const roomModal = document.createElement('div');
        roomModal.id = 'room-modal';
        roomModal.className = 'room-modal hidden';
        roomModal.innerHTML = `
            <div class="room-modal-content">
                <button class="close-btn" id="close-room-modal">✕</button>
                
                <div class="room-create hidden" id="room-create-view">
                    <h3>🏠 Your Room</h3>
                    <div class="room-code-display">
                        <span id="room-code">------</span>
                    </div>
                    <p>Share this code with your friend!</p>
                    <button class="btn-copy" id="btn-copy-code">📋 Copy Code</button>
                    <div class="waiting-indicator">
                        <div class="spinner"></div>
                        <span>Waiting for opponent...</span>
                    </div>
                </div>
                
                <div class="room-join hidden" id="room-join-view">
                    <h3>🚪 Join Room</h3>
                    <input type="text" id="room-code-input" placeholder="Enter Room Code" maxlength="6">
                    <button class="btn-join" id="btn-join-confirm">JOIN</button>
                </div>
                
                <div class="room-spectate hidden" id="room-spectate-view">
                    <h3>👀 Spectate Game</h3>
                    <div class="active-games-list" id="active-games-list">
                        <p>Loading games...</p>
                    </div>
                </div>
            </div>
        `;

        // Create lobby panel
        const lobbyPanel = document.createElement('div');
        lobbyPanel.id = 'lobby-panel';
        lobbyPanel.className = 'lobby-panel hidden';
        lobbyPanel.innerHTML = `
            <div class="lobby-header">
                <h3>🎱 LOBBY</h3>
                <span class="online-count" id="online-count">0 Online</span>
            </div>
            <div class="lobby-tabs">
                <button class="tab-btn active" data-tab="available">Available</button>
                <button class="tab-btn" data-tab="playing">In Progress</button>
            </div>
            <div class="lobby-list" id="lobby-list"></div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(roomModal);
        document.body.appendChild(lobbyPanel);

        // Add styles
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('matchmaking-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'matchmaking-styles';
        styles.textContent = `
            .matchmaking-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                animation: fadeIn 0.3s ease;
            }

            .matchmaking-overlay.hidden {
                display: none;
            }

            .matchmaking-modal {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 500px;
                border: 2px solid rgba(0, 212, 255, 0.3);
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
            }

            .matchmaking-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
            }

            .matchmaking-header h2 {
                font-family: 'Orbitron', sans-serif;
                font-size: 1.5rem;
                color: #00d4ff;
                margin: 0;
            }

            .close-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: #fff;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1.2rem;
                transition: all 0.3s;
            }

            .close-btn:hover {
                background: rgba(255, 0, 0, 0.3);
            }

            .tier-selection h3 {
                text-align: center;
                color: #8899aa;
                margin-bottom: 20px;
            }

            .tier-cards {
                display: flex;
                gap: 15px;
                margin-bottom: 25px;
            }

            .tier-card {
                flex: 1;
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 20px 15px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
            }

            .tier-card:hover {
                border-color: rgba(0, 212, 255, 0.5);
                transform: translateY(-3px);
            }

            .tier-card.selected {
                border-color: #00d4ff;
                background: rgba(0, 212, 255, 0.1);
                box-shadow: 0 0 30px rgba(0, 212, 255, 0.2);
            }

            .tier-icon {
                font-size: 2rem;
                display: block;
                margin-bottom: 10px;
            }

            .tier-name {
                display: block;
                font-weight: 600;
                margin-bottom: 5px;
            }

            .tier-wager {
                display: block;
                font-size: 0.85rem;
                color: #ffd700;
            }

            .btn-find-match {
                width: 100%;
                padding: 15px;
                font-family: 'Orbitron', sans-serif;
                font-size: 1.1rem;
                font-weight: 700;
                background: linear-gradient(135deg, #00d4ff 0%, #0088aa 100%);
                border: none;
                border-radius: 30px;
                color: #000;
                cursor: pointer;
                transition: all 0.3s;
            }

            .btn-find-match:hover {
                transform: scale(1.02);
                box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
            }

            .searching-state {
                text-align: center;
                padding: 20px;
            }

            .search-animation {
                position: relative;
                width: 100px;
                height: 100px;
                margin: 0 auto 20px;
            }

            .spinner-ring {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 4px solid rgba(0, 212, 255, 0.2);
                border-top-color: #00d4ff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .search-icon {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 2.5rem;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .search-text {
                font-size: 1.2rem;
                margin-bottom: 10px;
            }

            .search-time {
                color: #ffd700;
                font-size: 1.1rem;
            }

            .search-info {
                color: #8899aa;
                font-size: 0.9rem;
                margin-top: 10px;
            }

            .btn-cancel {
                margin-top: 20px;
                padding: 12px 40px;
                background: rgba(255, 0, 0, 0.2);
                border: 1px solid rgba(255, 0, 0, 0.4);
                color: #ff6b6b;
                border-radius: 25px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s;
            }

            .btn-cancel:hover {
                background: rgba(255, 0, 0, 0.3);
            }

            .match-found-state {
                text-align: center;
                padding: 20px;
            }

            .match-found-animation {
                font-size: 4rem;
                animation: pulse 0.5s ease infinite alternate;
            }

            @keyframes pulse {
                from { transform: scale(1); }
                to { transform: scale(1.1); }
            }

            .match-found-state h3 {
                color: #00ff88;
                font-family: 'Orbitron', sans-serif;
                font-size: 1.5rem;
                margin: 15px 0;
            }

            .opponent-info {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
            }

            .btn-ready {
                padding: 15px 50px;
                font-family: 'Orbitron', sans-serif;
                font-size: 1.2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #00ff88 0%, #00aa55 100%);
                border: none;
                border-radius: 30px;
                color: #000;
                cursor: pointer;
                transition: all 0.3s;
            }

            .btn-ready:hover {
                transform: scale(1.05);
                box-shadow: 0 10px 30px rgba(0, 255, 136, 0.3);
            }

            .room-options {
                display: flex;
                gap: 10px;
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .btn-room {
                flex: 1;
                padding: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #fff;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }

            .btn-room:hover {
                border-color: #00d4ff;
                background: rgba(0, 212, 255, 0.1);
            }

            .room-icon {
                font-size: 1.5rem;
            }

            /* Room Modal */
            .room-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
            }

            .room-modal.hidden {
                display: none;
            }

            .room-modal-content {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 400px;
                text-align: center;
                position: relative;
            }

            .room-code-display {
                background: #000;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
            }

            .room-code-display span {
                font-family: 'Orbitron', monospace;
                font-size: 2.5rem;
                letter-spacing: 8px;
                color: #00d4ff;
            }

            .btn-copy, .btn-join {
                padding: 12px 30px;
                background: linear-gradient(135deg, #00d4ff 0%, #0088aa 100%);
                border: none;
                border-radius: 25px;
                color: #000;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }

            .btn-copy:hover, .btn-join:hover {
                transform: scale(1.05);
            }

            .waiting-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin-top: 20px;
                color: #8899aa;
            }

            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(0, 212, 255, 0.2);
                border-top-color: #00d4ff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            #room-code-input {
                width: 100%;
                padding: 15px;
                font-family: 'Orbitron', monospace;
                font-size: 1.5rem;
                text-align: center;
                letter-spacing: 8px;
                background: rgba(0, 0, 0, 0.5);
                border: 2px solid rgba(0, 212, 255, 0.3);
                border-radius: 10px;
                color: #00d4ff;
                margin-bottom: 20px;
                text-transform: uppercase;
            }

            #room-code-input:focus {
                outline: none;
                border-color: #00d4ff;
            }

            .active-games-list {
                max-height: 300px;
                overflow-y: auto;
            }

            .game-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 10px;
                margin: 10px 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: all 0.3s;
            }

            .game-item:hover {
                background: rgba(0, 212, 255, 0.1);
                border: 1px solid rgba(0, 212, 255, 0.3);
            }

            /* Lobby Panel */
            .lobby-panel {
                position: fixed;
                left: 20px;
                top: 80px;
                width: 280px;
                background: linear-gradient(180deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
                border-radius: 15px;
                border: 1px solid rgba(0, 212, 255, 0.2);
                overflow: hidden;
                z-index: 100;
            }

            .lobby-panel.hidden {
                display: none;
            }

            .lobby-header {
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .lobby-header h3 {
                margin: 0;
                font-family: 'Orbitron', sans-serif;
                font-size: 0.9rem;
                color: #00d4ff;
            }

            .online-count {
                font-size: 0.8rem;
                color: #00ff88;
            }

            .lobby-tabs {
                display: flex;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .tab-btn {
                flex: 1;
                padding: 10px;
                background: none;
                border: none;
                color: #8899aa;
                cursor: pointer;
                transition: all 0.3s;
            }

            .tab-btn.active {
                color: #00d4ff;
                border-bottom: 2px solid #00d4ff;
            }

            .lobby-list {
                max-height: 300px;
                overflow-y: auto;
                padding: 10px;
            }

            .lobby-item {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                padding: 10px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .lobby-item:hover {
                background: rgba(0, 212, 255, 0.1);
            }

            .hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(styles);
    }

    bindEvents() {
        // Tier selection
        document.querySelectorAll('.tier-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedTier = card.dataset.tier;
            });
        });

        // Start search
        document.getElementById('btn-start-search')?.addEventListener('click', () => {
            this.startSearch();
        });

        // Cancel search
        document.getElementById('btn-cancel-search')?.addEventListener('click', () => {
            this.cancelSearch();
        });

        // Ready button
        document.getElementById('btn-ready')?.addEventListener('click', () => {
            this.network.ready();
        });

        // Close matchmaking
        document.getElementById('close-matchmaking')?.addEventListener('click', () => {
            this.hide();
        });

        // Room options
        document.getElementById('btn-create-room')?.addEventListener('click', () => {
            this.showCreateRoom();
        });

        document.getElementById('btn-join-room')?.addEventListener('click', () => {
            this.showJoinRoom();
        });

        document.getElementById('btn-spectate')?.addEventListener('click', () => {
            this.showSpectate();
        });

        // Room modal
        document.getElementById('close-room-modal')?.addEventListener('click', () => {
            this.hideRoomModal();
        });

        document.getElementById('btn-copy-code')?.addEventListener('click', () => {
            this.copyRoomCode();
        });

        document.getElementById('btn-join-confirm')?.addEventListener('click', () => {
            this.joinRoom();
        });

        // Room code input
        document.getElementById('room-code-input')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
    }

    bindNetworkEvents() {
        // Matchmaking events
        this.network.on('matchmaking_started', (data) => {
            this.showSearching(data);
        });

        this.network.on('match_found', (data) => {
            this.showMatchFound(data);
        });

        this.network.on('matchmaking_cancelled', () => {
            this.showTierSelection();
        });

        this.network.on('matchmaking_timeout', () => {
            this.showTierSelection();
            alert('No match found. Please try again.');
        });

        // Room events
        this.network.on('room_created', (data) => {
            this.onRoomCreated(data);
        });

        this.network.on('player_joined', (data) => {
            this.onPlayerJoined(data);
        });

        this.network.on('room_error', (data) => {
            alert(data.error);
        });

        // Game events
        this.network.on('game_start', () => {
            this.isSearching = false; // CRITICAL: Set this first to prevent cancelSearch being called!
            this.gameActive = true; // Mark game as active
            this.stopTimer(); // Stop the search timer if running
            this.hide();
            // Just hide the modal, don't leave the room!
            document.getElementById('room-modal')?.classList.add('hidden');
        });

        // Server stats
        this.network.on('server_stats', (data) => {
            this.updateStats(data);
        });

        // Active games for spectating
        this.network.on('active_games', (data) => {
            this.displayActiveGames(data.games);
        });
    }

    show() {
        document.getElementById('matchmaking-overlay')?.classList.remove('hidden');
        this.showTierSelection();
    }

    hide() {
        document.getElementById('matchmaking-overlay')?.classList.add('hidden');
        if (this.isSearching) {
            this.cancelSearch();
        }
    }

    showTierSelection() {
        document.getElementById('tier-selection')?.classList.remove('hidden');
        document.getElementById('searching-state')?.classList.add('hidden');
        document.getElementById('match-found-state')?.classList.add('hidden');
    }

    startSearch() {
        this.isSearching = true;
        this.searchStartTime = Date.now();
        this.network.findMatch(this.selectedTier);
    }

    showSearching(data) {
        document.getElementById('tier-selection')?.classList.add('hidden');
        document.getElementById('searching-state')?.classList.remove('hidden');
        document.getElementById('match-found-state')?.classList.add('hidden');

        this.startTimer();

        if (data.estimatedWait) {
            document.getElementById('search-info').textContent =
                `Estimated wait: ~${data.estimatedWait}s • Position: ${data.position}`;
        }
    }

    cancelSearch() {
        this.isSearching = false;
        this.stopTimer();
        this.network.cancelMatchmaking();
    }

    showMatchFound(data) {
        this.isSearching = false; // Match found, no longer searching
        this.stopTimer();

        document.getElementById('searching-state')?.classList.add('hidden');
        document.getElementById('match-found-state')?.classList.remove('hidden');

        const opponent = data.room.host.id === this.network.getPlayerId()
            ? data.room.guest
            : data.room.host;

        document.getElementById('opponent-info').innerHTML = `
            <div style="font-size: 1.2rem; font-weight: 600;">${opponent?.username || 'Opponent'}</div>
            <div style="color: #ffd700;">ELO: ${opponent?.elo || 1200}</div>
        `;

        document.getElementById('wager-info').textContent = `Wager: ${data.wager} 💰`;
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.searchStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            document.getElementById('search-timer').textContent =
                `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    showCreateRoom() {
        document.getElementById('room-modal')?.classList.remove('hidden');
        document.getElementById('room-create-view')?.classList.remove('hidden');
        document.getElementById('room-join-view')?.classList.add('hidden');
        document.getElementById('room-spectate-view')?.classList.add('hidden');

        this.network.createRoom(this.tiers[this.selectedTier].wager);
    }

    showJoinRoom() {
        document.getElementById('room-modal')?.classList.remove('hidden');
        document.getElementById('room-create-view')?.classList.add('hidden');
        document.getElementById('room-join-view')?.classList.remove('hidden');
        document.getElementById('room-spectate-view')?.classList.add('hidden');

        document.getElementById('room-code-input').value = '';
        document.getElementById('room-code-input').focus();
    }

    showSpectate() {
        document.getElementById('room-modal')?.classList.remove('hidden');
        document.getElementById('room-create-view')?.classList.add('hidden');
        document.getElementById('room-join-view')?.classList.add('hidden');
        document.getElementById('room-spectate-view')?.classList.remove('hidden');

        this.network.getActiveGames();
    }

    hideRoomModal() {
        document.getElementById('room-modal')?.classList.add('hidden');
        this.network.leaveRoom();
    }

    onRoomCreated(data) {
        document.getElementById('room-code').textContent = data.roomId;
    }

    onPlayerJoined(data) {
        // Player joined our room - close modal and start game
        if (data.room.status === 'ready') {
            this.hideRoomModal();
            this.hide();

            // Ready to start
            setTimeout(() => {
                this.network.ready();
            }, 500);
        }
    }

    joinRoom() {
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (code.length === 6) {
            this.network.joinRoom(code);
        } else {
            alert('Please enter a valid 6-character room code');
        }
    }

    copyRoomCode() {
        const code = document.getElementById('room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copy-code');
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = '📋 Copy Code';
            }, 2000);
        });
    }

    displayActiveGames(games) {
        const list = document.getElementById('active-games-list');
        if (!list) return;

        if (!games || games.length === 0) {
            list.innerHTML = '<p style="color: #8899aa; text-align: center;">No active games</p>';
            return;
        }

        list.innerHTML = games.map(game => `
            <div class="game-item" data-room="${game.id}">
                <div>
                    <div>${game.host?.username} vs ${game.guest?.username}</div>
                    <div style="font-size: 0.8rem; color: #8899aa;">
                        Wager: ${game.wager} 💰 • ${game.spectatorCount} watching
                    </div>
                </div>
                <button class="btn-spectate-game">👀</button>
            </div>
        `).join('');

        // Add click handlers
        list.querySelectorAll('.game-item').forEach(item => {
            item.addEventListener('click', () => {
                this.network.spectateRoom(item.dataset.room);
            });
        });
    }

    updateStats(data) {
        const onlineEl = document.getElementById('online-count');
        if (onlineEl) {
            onlineEl.textContent = `${data.online} Online`;
        }
    }

    showLobby() {
        document.getElementById('lobby-panel')?.classList.remove('hidden');
    }

    hideLobby() {
        document.getElementById('lobby-panel')?.classList.add('hidden');
    }
}

// Make available globally
window.MatchmakingUI = MatchmakingUI;
