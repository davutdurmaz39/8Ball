// Turn Bar Over Table with Player Names
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const gameMain = document.getElementById('game-main');
        const tableContainer = document.getElementById('table-container');

        if (!gameMain || !tableContainer) return;

        // Create the player bar element
        const playerBar = document.createElement('div');
        playerBar.id = 'player-bar-above-table';
        playerBar.innerHTML = `
            <div class="player-bar-panel player-1" id="bar-p1-panel">
                <div class="player-bar-avatar" id="bar-p1-avatar">P1</div>
                <div class="player-bar-details">
                    <div class="player-bar-name" id="bar-p1-name">Player 1</div>
                    <div class="player-bar-type" id="bar-p1-type">--</div>
                </div>
            </div>
            
            <div class="turn-bar-center">
                <div class="turn-bar-text-center" id="bar-turn-text">PLAYER 1's TURN</div>
            </div>
            
            <div class="player-bar-panel player-2" id="bar-p2-panel">
                <div class="player-bar-avatar" id="bar-p2-avatar">P2</div>
                <div class="player-bar-details">
                    <div class="player-bar-name" id="bar-p2-name">Player 2</div>
                    <div class="player-bar-type" id="bar-p2-type">--</div>
                </div>
            </div>
        `;

        // Insert before table container
        gameMain.insertBefore(playerBar, tableContainer);

        // Sync function to update the bar from the header
        function syncPlayerBar() {
            // Sync turn text
            const turnText = document.querySelector('.turn-text');
            const barTurnText = document.getElementById('bar-turn-text');
            if (turnText && barTurnText) {
                barTurnText.textContent = turnText.textContent;
            }

            // Sync player 1 name
            const p1Name = document.getElementById('p1-name');
            const barP1Name = document.getElementById('bar-p1-name');
            if (p1Name && barP1Name) {
                barP1Name.textContent = p1Name.textContent;
            }

            // Sync player 2 name (from header)
            const p2Name = document.querySelector('.player-2 .player-name');
            const barP2Name = document.getElementById('bar-p2-name');
            if (p2Name && barP2Name) {
                barP2Name.textContent = p2Name.textContent;
            }

            // Sync player 1 ball type
            const p1Type = document.getElementById('p1-ball-type');
            const barP1Type = document.getElementById('bar-p1-type');
            if (p1Type && barP1Type) {
                barP1Type.textContent = p1Type.textContent;
            }

            // Sync player 2 ball type
            const p2Type = document.getElementById('p2-ball-type');
            const barP2Type = document.getElementById('bar-p2-type');
            if (p2Type && barP2Type) {
                barP2Type.textContent = p2Type.textContent;
            }

            // Sync active player
            const p1Panel = document.getElementById('bar-p1-panel');
            const p2Panel = document.getElementById('bar-p2-panel');
            const headerP1 = document.querySelector('.player-1');
            const headerP2 = document.querySelector('.player-2');

            if (p1Panel && headerP1) {
                if (headerP1.classList.contains('active')) {
                    p1Panel.classList.add('active');
                } else {
                    p1Panel.classList.remove('active');
                }
            }

            if (p2Panel && headerP2) {
                if (headerP2.classList.contains('active')) {
                    p2Panel.classList.add('active');
                } else {
                    p2Panel.classList.remove('active');
                }
            }
        }

        // Initial sync
        syncPlayerBar();

        // Sync every 300ms
        setInterval(syncPlayerBar, 300);

        console.log('✅ Player bar above table initialized');
    });
})();
