/**
 * Wallet Manager for QWIN Token Integration
 * Handles Metamask connection, network switching, and token interactions.
 */

const QWIN_CONFIG = {
    // QWIN Token on BSC Testnet
    CONTRACT_ADDRESS: '0x4bdef5d6eeD17bB3c09e6678ce9690E4E4c7bA8e',
    CHAIN_ID: 97, // BNB Smart Chain TESTNET
    CHAIN_NAME: 'BNB Smart Chain Testnet',
    RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    BLOCK_EXPLORER: 'https://testnet.bscscan.com',
    SYMBOL: 'QWIN',
    DECIMALS: 18,
    // Treasury address for game deposits
    TREASURY_ADDRESS: '0xdB6Be62B413dF944d5ABa396F352B8c90b0D0cb8',
    // House fee on winnings (10%)
    HOUSE_FEE_PERCENT: 10
};

// Minimal ABI for ERC-20 Token (Balance, Transfer, Approve)
const QWIN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function approve(address spender, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contract = null;
        this.isConnected = false;
    }

    /**
     * Initialize the wallet manager
     * Checks if window.ethereum is available
     */
    init() {
        if (window.ethereum) {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            console.log('✅ Web3 Provider Initialized');
            return true;
        } else {
            console.warn('⚠️ No crypto wallet found. Please install Metamask.');
            return false;
        }
    }

    /**
     * Connect to the wallet
     */
    async connect() {
        if (!this.init()) {
            alert('Please install Metamask or TrustWallet to use this feature!');
            return null;
        }

        try {
            // Request account access
            const accounts = await this.provider.send("eth_requestAccounts", []);
            this.userAddress = accounts[0];
            this.signer = this.provider.getSigner();
            this.isConnected = true;

            console.log('👛 Wallet Connected:', this.userAddress);

            // Ensure we are on the correct network
            await this.checkNetwork();

            // Initialize token contract
            this.contract = new ethers.Contract(
                QWIN_CONFIG.CONTRACT_ADDRESS,
                QWIN_ABI,
                this.signer
            );

            return this.userAddress;

        } catch (error) {
            console.error('❌ Wallet Connection Failed:', error);
            throw error;
        }
    }

    /**
     * Check and switch to BNB Chain if necessary
     */
    async checkNetwork() {
        const network = await this.provider.getNetwork();
        if (network.chainId !== QWIN_CONFIG.CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: ethers.utils.hexValue(QWIN_CONFIG.CHAIN_ID) }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask.
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: ethers.utils.hexValue(QWIN_CONFIG.CHAIN_ID),
                                chainName: QWIN_CONFIG.CHAIN_NAME,
                                nativeCurrency: {
                                    name: 'BNB',
                                    symbol: 'BNB',
                                    decimals: 18
                                },
                                rpcUrls: [QWIN_CONFIG.RPC_URL],
                                blockExplorerUrls: [QWIN_CONFIG.BLOCK_EXPLORER]
                            }],
                        });
                    } catch (addError) {
                        console.error('Failed to add network:', addError);
                        throw addError;
                    }
                } else {
                    console.error('Failed to switch network:', switchError);
                    throw switchError;
                }
            }
        }
    }

    /**
     * Sign a message for authentication
     * @param {string} message - Message to sign
     */
    async signMessage(message) {
        if (!this.signer) throw new Error('Wallet not connected');
        return await this.signer.signMessage(message);
    }

    /**
     * Get QWIN Token Balance
     */
    async getTokenBalance() {
        if (!this.contract || !this.userAddress) return '0';
        try {
            const balance = await this.contract.balanceOf(this.userAddress);
            return ethers.utils.formatUnits(balance, QWIN_CONFIG.DECIMALS);
        } catch (error) {
            console.error('Error fetching token balance:', error);
            return '0';
        }
    }

    /**
     * Deposit QWIN tokens to game treasury
     * @param {string} amount - Amount to deposit
     */
    async deposit(amount) {
        if (!this.contract) throw new Error('Wallet not connected');

        try {
            // Check if treasury address is set
            if (QWIN_CONFIG.TREASURY_ADDRESS === '0x0000000000000000000000000000000000000000') {
                console.warn('⚠️ Treasury address not set. Mocking deposit for testing.');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: true, mock: true };
            }

            const amountWei = ethers.utils.parseUnits(amount.toString(), QWIN_CONFIG.DECIMALS);

            // Transfer QWIN to game treasury
            const tx = await this.contract.transfer(QWIN_CONFIG.TREASURY_ADDRESS, amountWei);
            console.log('💰 Deposit transaction sent:', tx.hash);
            await tx.wait();
            console.log('✅ Deposit confirmed');

            return { success: true, txHash: tx.hash };
        } catch (error) {
            console.error('❌ Deposit failed:', error);
            throw error;
        }
    }

    /**
     * Withdraw QWIN tokens from game
     * @param {string} amount - Amount to withdraw
     */
    async withdraw(amount) {
        // This requires backend interaction
        console.log('Withdrawal requested:', amount);
        // In a real implementation, this would call an API endpoint
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        return true;
    }
}

// Export global instance
window.walletManager = new WalletManager();
