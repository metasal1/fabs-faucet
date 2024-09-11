import TelegramBot from 'node-telegram-bot-api';
import { PublicKey } from '@solana/web3.js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const token: string = process.env.BOT_TOKEN || '';
const botUsername: string = process.env.BOT_USERNAME || '';

if (!token || !botUsername) {
    console.error('BOT_TOKEN or BOT_USERNAME is not set in the environment variables.');
    process.exit(1);
}

// Create a bot instance
const bot: TelegramBot = new TelegramBot(token, { polling: true });

// File to store user data
const DATA_FILE: string = 'users.json';

// Define the User interface
interface User {
    userId: number;
    username: string;
    referralCode: string;
    referrals: number;
    referredBy?: string;
    solanaWallet?: string;
}

// Define the Users type
type Users = {
    [username: string]: User;
};

// Load users from file or initialize if file doesn't exist
let users: Users = {};
if (fs.existsSync(DATA_FILE)) {
    const data: string = fs.readFileSync(DATA_FILE, 'utf8');
    users = JSON.parse(data);
} else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users), 'utf8');
}

// Function to save users to file
function saveUsers(): void {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users), 'utf8');
}

// Function to generate a random referral code
function generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to check if the message is from a private chat
function isPrivateChat(msg: TelegramBot.Message): boolean {
    return msg.chat.type === 'private';
}

// Function to generate a referral link
function generateReferralLink(referralCode: string): string {
    return `https://t.me/${botUsername}?ref=${referralCode}`;
}

// Function to validate Solana wallet address using @solana/web3.js
function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
}

// Function to process referral
function processReferral(chatId: number, username: string, referralCode: string): void {
    const referrer = Object.values(users).find(user => user.referralCode === referralCode);
    if (referrer && referrer.username !== username) {
        referrer.referrals += 1;
        users[username].referredBy = referrer.username;
        bot.sendMessage(chatId, `You were successfully referred by user @${referrer.username}.`);
        saveUsers();
    } else if (referrer && referrer.username === username) {
        bot.sendMessage(chatId, "You can't refer yourself!");
    } else {
        bot.sendMessage(chatId, "Invalid referral code. Please check and try again.");
    }
}

// Function to send referral info with inline keyboard
function sendReferralInfo(chatId: number, user: User): void {
    const referralLink = generateReferralLink(user.referralCode);
    const message = `
Your referral code: \`${user.referralCode}\`
Your referral link: ${referralLink}

Click on the code above to copy it.
`;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// Function to send welcome message with instructions
function sendWelcomeMessage(chatId: number, referralCode: string, referralLink: string): void {
    const welcomeMessage = `
Welcome to FABS! 🎉

Here's how to get started:

1. Your referral code is: \`${referralCode}\`
2. Your referral link is: ${referralLink}

Commands you can use:
• /link - Get your referral link
• /code - View your referral code
• /stats - Check your referral stats
• /wallet - View your Solana wallet address
• /setwallet ADDRESS - Set your Solana wallet address
• /addref CODE - Add a referral code (if you haven't already)
• /top - See top referrers

Tips:
• Share your referral link or code with friends to earn rewards!
• Make sure to set your Solana wallet address to receive rewards.
• Check your stats regularly to track your progress.

Need help? Just type /help for assistance.

Happy referring with FABS! 🚀
`;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
}

// Handle /ref command (previously /start)
bot.onText(/\/ref(?:\s+(\w+))?/, (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;
    const userId: number | undefined = msg.from?.id;

    if (!username || !userId) {
        bot.sendMessage(chatId, 'Please set a username in your Telegram settings to use FABS.');
        return;
    }

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, `Please start FABS in a private chat to get your referral code. [Click here to start a private chat](https://t.me/${botUsername}?ref=fabs)`, { parse_mode: 'Markdown' });
        return;
    }

    const referralCode: string | undefined = match?.[1];

    if (!users[username]) {
        const userReferralCode: string = generateReferralCode();
        users[username] = { userId, username, referralCode: userReferralCode, referrals: 0 };

        if (referralCode) {
            processReferral(chatId, username, referralCode);
        }

        const referralLink = generateReferralLink(userReferralCode);
        sendWelcomeMessage(chatId, userReferralCode, referralLink);
        saveUsers();
    } else {
        // Update userId in case it has changed (very rare, but possible)
        users[username].userId = userId;
        saveUsers();
        bot.sendMessage(chatId, 'Welcome back to FABS! Need a refresher? Type /help for a list of commands.');
        sendReferralInfo(chatId, users[username]);
    }
});

// Handle /help command
bot.onText(/\/help/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const helpMessage = `
Here are the commands you can use with FABS:

• /ref - Start the bot and get your referral code
• /link - Get your referral link
• /code - View your referral code
• /stats - Check your referral stats
• /wallet - View your Solana wallet address
• /setwallet ADDRESS - Set your Solana wallet address
• /addref CODE - Add a referral code (if you haven't already)
• /top - See top referrers
`;

    bot.sendMessage(chatId, helpMessage);
});

// Handle /addref command
bot.onText(/\/addref(?:\s+(\w+))?/, (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;
    const referralCode: string | undefined = match?.[1];

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    if (users[username].referredBy) {
        bot.sendMessage(chatId, "You've already been referred by someone.");
        return;
    }

    if (referralCode) {
        processReferral(chatId, username, referralCode);
    } else {
        bot.sendMessage(chatId, "Please provide a referral code. Usage: /addref CODE");
    }
});

// Handle /setwallet command
bot.onText(/\/setwallet(?:\s+(\S+))?/, (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;
    const walletAddress: string | undefined = match?.[1];

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    if (walletAddress) {
        if (isValidSolanaAddress(walletAddress)) {
            users[username].solanaWallet = walletAddress;
            saveUsers();
            bot.sendMessage(chatId, `Your Solana wallet address has been set to: ${walletAddress}`);
        } else {
            bot.sendMessage(chatId, "Invalid Solana wallet address. Please check and try again.");
        }
    } else {
        bot.sendMessage(chatId, "Please provide a Solana wallet address. Usage: /setwallet ADDRESS");
    }
});

// Handle /wallet command
bot.onText(/\/wallet/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    if (users[username].solanaWallet) {
        bot.sendMessage(chatId, `Your current Solana wallet address is: ${users[username].solanaWallet}`);
    } else {
        bot.sendMessage(chatId, "You haven't set a Solana wallet address yet. Use /setwallet ADDRESS to set one.");
    }
});

// Handle /link command
bot.onText(/\/link/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    sendReferralInfo(chatId, users[username]);
});

// Handle /code command
bot.onText(/\/code/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, 'For privacy reasons, I\'ll send your referral code in a private message.');
        bot.sendMessage(users[username].userId, `Your referral code is: \`${users[username].referralCode}\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `Your referral code is: \`${users[username].referralCode}\``, { parse_mode: 'Markdown' });
    }
});

// Handle /stats command
bot.onText(/\/stats/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const username: string | undefined = msg.from?.username;

    if (!username || !users[username]) {
        bot.sendMessage(chatId, "You need to start FABS first. Use the /ref command.");
        return;
    }

    const user: User = users[username];
    let message = `You have referred ${user.referrals} users.`;
    if (user.referredBy) {
        message += `\nYou were referred by @${user.referredBy}.`;
    }
    if (user.solanaWallet) {
        message += `\nYour Solana wallet: ${user.solanaWallet}`;
    } else {
        message += '\nYou haven\'t set a Solana wallet yet. Use /setwallet to set one.';
    }

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, 'For privacy reasons, I\'ll send your referral stats in a private message.');
        bot.sendMessage(user.userId, message);
    } else {
        bot.sendMessage(chatId, message);
    }
});

// Handle /top command
bot.onText(/\/top/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;

    const topReferrers: User[] = Object.values(users)
        .sort((a, b) => b.referrals - a.referrals)
        .slice(0, 5);

    let message: string = 'Top 5 Referrers in FABS:\n\n';
    topReferrers.forEach((user, index) => {
        message += `${index + 1}. @${user.username}: ${user.referrals} referrals\n`;
    });

    bot.sendMessage(chatId, message);
});

// Handle incorrect commands
bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/') && !msg.text.match(/^\/(ref|help|addref|setwallet|wallet|link|code|stats|top)/)) {
        bot.sendMessage(msg.chat.id, "Unknown command. Type /help for a list of available commands.");
    }
});

console.log('FABS is running...');