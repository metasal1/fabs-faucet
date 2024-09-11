import TelegramBot from 'node-telegram-bot-api';
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
    referralCode: string;
    referrals: number;
}

// Define the Users type
type Users = {
    [userId: string]: User;
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
    return `https://t.me/${botUsername}?start=${referralCode}`;
}

// Handle /start command
bot.onText(/\/start(?:\s+(\w+))?/, (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId: number = msg.chat.id;
    const userId: string = msg.from!.id.toString();
    const referralCode: string | undefined = match?.[1];

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, 'Please start the bot in a private chat to get your referral code.');
        return;
    }

    if (!users[userId]) {
        const userReferralCode: string = generateReferralCode();
        users[userId] = { referralCode: userReferralCode, referrals: 0 };

        if (referralCode && users[referralCode]) {
            users[referralCode].referrals += 1;
            bot.sendMessage(chatId, `Welcome! You were referred by a user with the code ${referralCode}.`);
        } else {
            bot.sendMessage(chatId, 'Welcome to the bot!');
        }

        const referralLink = generateReferralLink(userReferralCode);
        bot.sendMessage(chatId, `Your referral code is: ${userReferralCode}\nYour referral link is: ${referralLink}`);
        saveUsers();
    } else {
        bot.sendMessage(chatId, 'Welcome back!');
    }
});

// Handle /link command
bot.onText(/\/link/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const userId: string = msg.from!.id.toString();

    if (users[userId]) {
        const user: User = users[userId];
        const referralLink = generateReferralLink(user.referralCode);
        bot.sendMessage(chatId, `Your referral link is: ${referralLink}\nShare this link with others to refer them!`);
    } else {
        bot.sendMessage(chatId, "You don't have a referral code yet. Use /start to get one.");
    }
});

// Handle /code command
bot.onText(/\/code/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const userId: string = msg.from!.id.toString();

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, 'For privacy reasons, I\'ll send your referral code in a private message.');
        bot.sendMessage(parseInt(userId), 'Here\'s your referral code information:');
    }

    if (users[userId]) {
        const user: User = users[userId];
        bot.sendMessage(parseInt(userId), `Your referral code is: ${user.referralCode}`);
    } else {
        bot.sendMessage(parseInt(userId), "You don't have a referral code yet. Use /start to get one.");
    }
});

// Handle /stats command
bot.onText(/\/stats/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;
    const userId: string = msg.from!.id.toString();

    if (!isPrivateChat(msg)) {
        bot.sendMessage(chatId, 'For privacy reasons, I\'ll send your referral stats in a private message.');
        bot.sendMessage(parseInt(userId), 'Here are your referral stats:');
    }

    if (users[userId]) {
        const user: User = users[userId];
        bot.sendMessage(parseInt(userId), `You have referred ${user.referrals} users.`);
    } else {
        bot.sendMessage(parseInt(userId), "You haven't made any referrals yet.");
    }
});

// Handle /top command
bot.onText(/\/top/, (msg: TelegramBot.Message) => {
    const chatId: number = msg.chat.id;

    const topReferrers: [string, User][] = Object.entries(users)
        .sort((a, b) => b[1].referrals - a[1].referrals)
        .slice(0, 5);

    let message: string = 'Top 5 Referrers:\n\n';
    topReferrers.forEach((user, index) => {
        message += `${index + 1}. User ${user[0]}: ${user[1].referrals} referrals\n`;
    });

    bot.sendMessage(chatId, message);
});

console.log('Bot is running...');