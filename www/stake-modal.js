// ============================================
// STAKE MODAL FUNCTIONS
// ============================================
(function () {
    let selectedStake = 100;

    window.openStakeModal = function () {
        document.getElementById('stake-modal').classList.add('active');
        if (window.currentUser) {
            document.getElementById('modal-balance').textContent =
                (window.currentUser.coins || 0).toLocaleString();
        }
    };

    window.closeStakeModal = function () {
        document.getElementById('stake-modal').classList.remove('active');
    };

    window.selectStake = function (element, stake) {
        document.querySelectorAll('.stake-card').forEach(card => {
            card.classList.remove('selected');
        });
        element.classList.add('selected');
        selectedStake = stake;

        const userCoins = window.currentUser?.coins || 0;
        const btn = document.getElementById('btn-start-matchmaking');
        if (userCoins < stake) {
            btn.disabled = true;
            btn.textContent = '❌ INSUFFICIENT COINS';
        } else {
            btn.disabled = false;
            btn.innerHTML = '🎮 FIND MATCH';
        }
    };

    window.startMatchmaking = function () {
        window.closeStakeModal();
        // Go to the matchmaking page with the selected stake
        window.location.href = `matchmaking.html?stake=${selectedStake}`;
    };

    // Initialize when DOM is ready
    function init() {
        const modal = document.getElementById('stake-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'stake-modal') {
                    window.closeStakeModal();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
