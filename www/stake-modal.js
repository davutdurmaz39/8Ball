// ============================================
// STAKE MODAL FUNCTIONS
// ============================================
(function () {
    let selectedStake = 100;
    let selectedCurrency = 'coins'; // 'coins' or 'qwin'

    window.openStakeModal = function () {
        document.getElementById('stake-modal').classList.add('active');
        updateBalanceDisplay();
    };

    window.closeStakeModal = function () {
        document.getElementById('stake-modal').classList.remove('active');
    };

    window.toggleCurrency = function (currency) {
        selectedCurrency = currency;

        // Update toggle buttons
        document.getElementById('btn-currency-coins').classList.toggle('active', currency === 'coins');
        document.getElementById('btn-currency-qwin').classList.toggle('active', currency === 'qwin');

        // Update toggle styles
        const btnCoins = document.getElementById('btn-currency-coins');
        const btnQwin = document.getElementById('btn-currency-qwin');

        if (currency === 'coins') {
            btnCoins.style.background = 'var(--accent-blue)';
            btnCoins.style.color = '#fff';
            btnQwin.style.background = 'transparent';
            btnQwin.style.color = '#8899aa';

            document.getElementById('stakes-coins').style.display = 'grid';
            document.getElementById('stakes-qwin').style.display = 'none';

            // Select default coin stake if needed
            selectStake(document.querySelector('#stakes-coins .stake-card[data-stake="100"]'), 100);
        } else {
            btnQwin.style.background = 'var(--accent-blue)';
            btnQwin.style.color = '#fff';
            btnCoins.style.background = 'transparent';
            btnCoins.style.color = '#8899aa';

            document.getElementById('stakes-coins').style.display = 'none';
            document.getElementById('stakes-qwin').style.display = 'grid';

            // Select default qwin stake if needed
            selectStake(document.querySelector('#stakes-qwin .stake-card[data-stake="10"]'), 10);
        }

        updateBalanceDisplay();
    };

    function updateBalanceDisplay() {
        if (!window.currentUser) return;

        const balanceEl = document.getElementById('modal-balance');
        const iconEl = document.getElementById('balance-icon');

        if (selectedCurrency === 'coins') {
            balanceEl.textContent = (window.currentUser.coins || 0).toLocaleString();
            iconEl.textContent = '💰';
            balanceEl.parentElement.style.color = '#fff';
        } else {
            balanceEl.textContent = (window.currentUser.qwinBalance || 0).toFixed(2);
            iconEl.textContent = '💎';
            balanceEl.parentElement.style.color = '#00d4ff';
        }
    }

    window.selectStake = function (element, stake) {
        // Remove selected class from ALL cards
        document.querySelectorAll('.stake-card').forEach(card => {
            card.classList.remove('selected');
        });

        if (element) {
            element.classList.add('selected');
        }
        selectedStake = stake;

        const userBalance = selectedCurrency === 'coins'
            ? (window.currentUser?.coins || 0)
            : (window.currentUser?.qwinBalance || 0);

        const btn = document.getElementById('btn-start-matchmaking');

        if (userBalance < stake) {
            btn.disabled = true;
            btn.textContent = `❌ INSUFFICIENT ${selectedCurrency === 'coins' ? 'COINS' : 'QWIN'}`;
            btn.style.background = 'rgba(255, 50, 50, 0.2)';
            btn.style.borderColor = 'rgba(255, 50, 50, 0.4)';
        } else {
            btn.disabled = false;
            btn.innerHTML = '🎮 FIND MATCH';
            btn.style.background = ''; // Reset to default CSS
            btn.style.borderColor = '';
        }
    };

    window.startMatchmaking = function () {
        window.closeStakeModal();
        // Go to the matchmaking page with the selected stake and currency
        window.location.href = `matchmaking.html?stake=${selectedStake}&currency=${selectedCurrency}`;
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
