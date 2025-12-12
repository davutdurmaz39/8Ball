// Add player-info-bar dynamically
document.addEventListener('DOMContentLoaded', () => {
    const gameMain = document.getElementById('game-main');
    const tableContainer = document.getElementById('table-container');

    if (gameMain && tableContainer && !document.getElementById('player-info-bar')) {
        const playerInfoBar = document.createElement('div');
        playerInfoBar.id = 'player-info-bar';
        playerInfoBar.innerHTML = `
            <div class="player-panel player-1-panel" id="p1-panel">
                <div class="avatar-wrapper">
                    <div class="avatar" id="p1-avatar-top">P1</div>
                    <span class="player-flag" id="p1-flag-top"></span>
                </div>
                <div class="player-panel-details">
                    <div class="player-panel-name" id="p1-name-top">Player 1</div>
                    <div class="player-panel-flag" id="p1-ball-type-top">--</div>
                </div>
            </div>

            <div class="turn-bar">
                <div class="turn-bar-text" id="turn-bar-text">PLAYER 1's TURN</div>
            </div>

            <div class="player-panel player-2-panel" id="p2-panel">
                <div class="player-panel-details">
                    <div class="player-panel-name" id="p2-name-top">Player 2</div>
                    <div class="player-panel-flag" id="p2-ball-type-top">--</div>
                </div>
                <div class="avatar-wrapper">
                    <div class="avatar" id="p2-avatar-top">P2</div>
                    <span class="player-flag" id="p2-flag-top"></span>
                </div>
            </div>
        `;

        // Insert before table-container
        gameMain.insertBefore(playerInfoBar, tableContainer);
        console.log('✅ Player info bar added dynamically');
    }
});
