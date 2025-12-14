/**
 * 8-Ball Pool Game Server with Multiplayer Support
 * Features: Authentication, WebSocket, Matchmaking, Tournaments
 */

const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');

// Multiplayer modules
const { MultiplayerServer } = require('./multiplayer/WebSocketHandler');
const { TournamentManager } = require('./multiplayer/Tournament');
const { EloCalculator } = require('./multiplayer/MatchmakingQueue');

const app = express();
const PORT = process.env.PORT || 8000;

// Environment config
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = '7d';

// OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '950001518536-tfqa7eh74nf457g34do7dgmanos286b3.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'YOUR_FACEBOOK_APP_SECRET';
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:8000';

// In-memory user database (replace with real database in production)
const users = new Map();
let nextUserId = 1;

// Sample users for testing
const samplePasswordHash = bcrypt.hashSync('password123', 10);
users.set('demo@example.com', {
    id: nextUserId++,
    username: 'DemoPlayer',
    email: 'demo@example.com',
    password: samplePasswordHash,
    provider: 'email',
    coins: 5000,
    elo: 1200,
    gamesPlayed: 10,
    gamesWon: 6,
    createdAt: new Date().toISOString(),
    achievements: [],
    matchHistory: [],
    nationality: 'TR',
    profilePicture: null
});

users.set('pro@example.com', {
    id: nextUserId++,
    username: 'PoolPro',
    email: 'pro@example.com',
    password: samplePasswordHash,
    provider: 'email',
    coins: 15000,
    elo: 1650,
    gamesPlayed: 50,
    gamesWon: 35,
    createdAt: new Date().toISOString(),
    achievements: ['first_win', 'ten_wins', 'streak_5', 'gold_rank'],
    matchHistory: [],
    nationality: 'US',
    profilePicture: null
});

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Initialize multiplayer server
const multiplayer = new MultiplayerServer(io, users);
const tournamentManager = new TournamentManager();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('token');
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
};

// Set auth cookie
const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

// ============ AUTH ROUTES ============

// Register with email/password
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ success: false, error: 'Username must be 3-20 characters' });
        }

        if (users.has(email.toLowerCase())) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        for (const user of users.values()) {
            if (user.username.toLowerCase() === username.toLowerCase()) {
                return res.status(400).json({ success: false, error: 'Username already taken' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            id: nextUserId++,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            provider: 'email',
            coins: 1000,
            elo: 1200,
            gamesPlayed: 0,
            gamesWon: 0,
            createdAt: new Date().toISOString(),
            achievements: [],
            matchHistory: [],
            nationality: null,
            profilePicture: null
        };

        users.set(email.toLowerCase(), user);

        const token = generateToken(user);
        setAuthCookie(res, token);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                elo: user.elo,
                rank: EloCalculator.getRankFromElo(user.elo)
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// Login with email/password
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const user = users.get(email.toLowerCase());
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const token = generateToken(user);
        setAuthCookie(res, token);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                coins: user.coins,
                elo: user.elo,
                rank: EloCalculator.getRankFromElo(user.elo)
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = users.get(req.user.email);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            coins: user.coins,
            elo: user.elo,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0,
            rank: EloCalculator.getRankFromElo(user.elo),
            achievements: user.achievements || [],
            createdAt: user.createdAt,
            nationality: user.nationality || null,
            profilePicture: user.profilePicture || null
        }
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
});

// ============ AVATAR UPLOAD ============

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        // Use timestamp for unique filename (user id will be added after auth)
        const filename = `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        cb(null, filename);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
    }
});

// Serve uploaded avatars statically
app.use('/uploads/avatars', express.static(uploadsDir));

// Upload avatar endpoint with error handling
app.post('/api/profile/avatar', authenticateToken, (req, res) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
            }
            return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const user = users.get(req.user.email);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            // Delete old avatar if exists
            if (user.profilePicture && user.profilePicture.startsWith('/uploads/avatars/')) {
                const oldPath = path.join(__dirname, user.profilePicture);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            // Save new avatar path
            const avatarUrl = `/uploads/avatars/${req.file.filename}`;
            user.profilePicture = avatarUrl;

            console.log('Avatar uploaded successfully:', avatarUrl);

            res.json({
                success: true,
                avatarUrl: avatarUrl,
                message: 'Avatar uploaded successfully'
            });
        } catch (error) {
            console.error('Avatar upload error:', error);
            res.status(500).json({ success: false, error: 'Failed to upload avatar' });
        }
    });
});

// Delete avatar endpoint
app.delete('/api/profile/avatar', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Delete avatar file if exists
        if (user.profilePicture && user.profilePicture.startsWith('/uploads/avatars/')) {
            const avatarPath = path.join(__dirname, user.profilePicture);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        user.profilePicture = null;

        res.json({
            success: true,
            message: 'Avatar removed successfully'
        });
    } catch (error) {
        console.error('Avatar delete error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete avatar' });
    }
});

// ============ GOOGLE OAUTH ============

app.get('/api/auth/google', (req, res) => {
    const redirectUri = `${OAUTH_CALLBACK_URL}/api/auth/google/callback`;
    const scope = encodeURIComponent('email profile');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    res.redirect(googleAuthUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.redirect('/login.html?error=google_auth_failed');
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: `${OAUTH_CALLBACK_URL}/api/auth/google/callback`,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();
        if (!tokens.access_token) {
            throw new Error('No access token received');
        }

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userInfoResponse.json();

        let user = users.get(googleUser.email);

        if (!user) {
            user = {
                id: nextUserId++,
                username: googleUser.name || `Player${nextUserId}`,
                email: googleUser.email,
                password: null,
                provider: 'google',
                googleId: googleUser.id,
                avatar: googleUser.picture,
                coins: 1000,
                elo: 1200,
                gamesPlayed: 0,
                gamesWon: 0,
                createdAt: new Date().toISOString(),
                achievements: [],
                matchHistory: []
            };
            users.set(googleUser.email, user);
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.redirect('/game.html');

    } catch (error) {
        console.error('Google OAuth error:', error);
        res.redirect('/login.html?error=google_auth_failed');
    }
});

// ============ FACEBOOK OAUTH ============

app.get('/api/auth/facebook', (req, res) => {
    const redirectUri = `${OAUTH_CALLBACK_URL}/api/auth/facebook/callback`;
    const scope = encodeURIComponent('email,public_profile');
    const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    res.redirect(facebookAuthUrl);
});

app.get('/api/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.redirect('/login.html?error=facebook_auth_failed');
    }

    try {
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(`${OAUTH_CALLBACK_URL}/api/auth/facebook/callback`)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`;
        const tokenResponse = await fetch(tokenUrl);
        const tokens = await tokenResponse.json();

        if (!tokens.access_token) {
            throw new Error('No access token received');
        }

        const userInfoResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokens.access_token}`);
        const fbUser = await userInfoResponse.json();

        if (!fbUser.email) {
            return res.redirect('/login.html?error=facebook_email_required');
        }

        let user = users.get(fbUser.email);

        if (!user) {
            user = {
                id: nextUserId++,
                username: fbUser.name || `Player${nextUserId}`,
                email: fbUser.email,
                password: null,
                provider: 'facebook',
                facebookId: fbUser.id,
                avatar: fbUser.picture?.data?.url,
                coins: 1000,
                elo: 1200,
                gamesPlayed: 0,
                gamesWon: 0,
                createdAt: new Date().toISOString(),
                achievements: [],
                matchHistory: []
            };
            users.set(fbUser.email, user);
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.redirect('/game.html');

    } catch (error) {
        console.error('Facebook OAuth error:', error);
        res.redirect('/login.html?error=facebook_auth_failed');
    }
});

// ============ LEADERBOARD ============

app.get('/api/leaderboard', (req, res) => {
    try {
        const type = req.query.type || 'elo';
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const players = Array.from(users.values())
            .filter(u => u.gamesPlayed > 0)
            .sort((a, b) => {
                if (type === 'wins') return (b.gamesWon || 0) - (a.gamesWon || 0);
                if (type === 'coins') return (b.coins || 0) - (a.coins || 0);
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
                coins: u.coins || 0,
                winRate: u.gamesPlayed ? ((u.gamesWon / u.gamesPlayed) * 100).toFixed(1) : '0.0',
                rankInfo: EloCalculator.getRankFromElo(u.elo || 1200)
            }));

        res.json({ success: true, leaderboard: players, type });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, error: 'Failed to load leaderboard' });
    }
});

// ============ PLAYER PROFILE ============

app.get('/api/profile/:username', (req, res) => {
    try {
        const { username } = req.params;

        let targetUser = null;
        for (const user of users.values()) {
            if (user.username.toLowerCase() === username.toLowerCase()) {
                targetUser = user;
                break;
            }
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            profile: {
                username: targetUser.username,
                coins: targetUser.coins,
                elo: targetUser.elo,
                rank: EloCalculator.getRankFromElo(targetUser.elo),
                gamesPlayed: targetUser.gamesPlayed,
                gamesWon: targetUser.gamesWon,
                winRate: targetUser.gamesPlayed > 0
                    ? ((targetUser.gamesWon / targetUser.gamesPlayed) * 100).toFixed(1)
                    : 0,
                achievements: targetUser.achievements || [],
                createdAt: targetUser.createdAt
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to load profile' });
    }
});

// Update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { username, avatar, settings, nationality, profilePicture } = req.body;

        if (username && username !== user.username) {
            // Check if username is taken
            for (const u of users.values()) {
                if (u.username.toLowerCase() === username.toLowerCase() && u.id !== user.id) {
                    return res.status(400).json({ success: false, error: 'Username already taken' });
                }
            }
            user.username = username;
        }

        if (avatar) {
            user.avatar = avatar;
        }

        if (nationality !== undefined) {
            user.nationality = nationality;
        }

        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        if (settings) {
            user.settings = { ...user.settings, ...settings };
        }

        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// ============ MATCH HISTORY ============

app.get('/api/matches', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const matches = (user.matchHistory || []).slice(0, limit);

        res.json({ success: true, matches });
    } catch (error) {
        console.error('Match history error:', error);
        res.status(500).json({ success: false, error: 'Failed to load match history' });
    }
});

// ============ ACHIEVEMENTS ============

app.get('/api/achievements', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const achievements = multiplayer.achievements.getPlayerAchievements(req.user.email);
        res.json({ success: true, ...achievements });
    } catch (error) {
        console.error('Achievements error:', error);
        res.status(500).json({ success: false, error: 'Failed to load achievements' });
    }
});

// ============ TOURNAMENTS ============

app.get('/api/tournaments', (req, res) => {
    try {
        const tournaments = tournamentManager.getActiveTournaments();
        res.json({ success: true, tournaments });
    } catch (error) {
        console.error('Tournaments error:', error);
        res.status(500).json({ success: false, error: 'Failed to load tournaments' });
    }
});

app.post('/api/tournaments', authenticateToken, (req, res) => {
    try {
        const { name, description, type, maxPlayers, entryFee } = req.body;

        const tournament = tournamentManager.createTournament({
            name: name || 'Pool Tournament',
            description,
            type: type || 'single_elimination',
            maxPlayers: maxPlayers || 8,
            entryFee: entryFee || 100
        });

        res.json({ success: true, tournament: tournament.toJSON() });
    } catch (error) {
        console.error('Create tournament error:', error);
        res.status(500).json({ success: false, error: 'Failed to create tournament' });
    }
});

app.post('/api/tournaments/:id/register', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const result = tournamentManager.registerPlayer(req.params.id, {
            id: user.id,
            username: user.username,
            elo: user.elo,
            coins: user.coins
        });

        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }

        // Deduct entry fee
        const tournament = tournamentManager.getTournament(req.params.id);
        if (tournament) {
            user.coins -= tournament.entryFee;
        }

        res.json({ success: true, position: result.position });
    } catch (error) {
        console.error('Tournament registration error:', error);
        res.status(500).json({ success: false, error: 'Failed to register' });
    }
});

// ============ SERVER STATS ============

app.get('/api/stats', (req, res) => {
    try {
        const stats = multiplayer.getStats();
        res.json({
            success: true,
            stats: {
                ...stats,
                totalUsers: users.size,
                activeTournaments: tournamentManager.getActiveTournaments().length
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load stats' });
    }
});

// ============ STATIC FILE SERVING ============

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/game.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

app.use(express.static(__dirname));

// ============ START SERVER ============

server.listen(PORT, () => {
    console.log(`\n🎱 8-Ball Pool Multiplayer Server Running!\n`);
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Network:  http://127.0.0.1:${PORT}\n`);
    console.log(`   Login:    http://localhost:${PORT}/login.html`);
    console.log(`   Game:     http://localhost:${PORT}/game.html\n`);
    console.log(`   WebSocket: ws://localhost:${PORT}\n`);
    console.log(`Demo credentials: demo@example.com / password123`);
    console.log(`Pro credentials:  pro@example.com / password123\n`);
    console.log(`Press Ctrl+C to stop the server\n`);
});

module.exports = app;
