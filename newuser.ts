import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const token = process.env.WELCOME_BOT_TOKEN;

if (!token) {
    console.error('WELCOME_BOT_TOKEN is not set in the environment variables');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadImage(url: string, filepath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image. Status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));
}

bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;

    for (const user of msg.new_chat_members) {
        try {
            // Create a welcome message that tags the user
            const welcomeMessage = `Welcome to the fam, [${user.first_name}](tg://user?id=${user.id})!`;

            const userIdentifier = user.first_name || user.username;
            const encodedUserIdentifier = encodeURIComponent(userIdentifier);
            const imageUrl = `https://run.fabs.fun/api/welcome?number=${encodedUserIdentifier}`;
            const imagePath = path.join(__dirname, `welcome-image-${userIdentifier}.jpg`);

            await downloadImage(imageUrl, imagePath);

            // Send the welcome message
            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

            // Send the image
            await bot.sendPhoto(chatId, fs.createReadStream(imagePath));

            // Delete the image file after sending
            fs.unlinkSync(imagePath);
        } catch (error) {
            console.error('Error in welcome process:', error);
        }
    }
});

console.log('Bot is running...');
