import { Telegraf } from 'telegraf';
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';
import fs from 'fs-extra';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection(process.env.RPC, 'confirmed');

const MINT_ADDRESS = new PublicKey('ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CLAIMS_FILE = 'claims.json';
const CLAIM_COOLDOWN = 4 * 60 * 60 * 1000; // 24 hours in milliseconds

// Function to load claims
const loadClaims = () => {
    if (fs.existsSync(CLAIMS_FILE)) {
        return fs.readJSONSync(CLAIMS_FILE);
    }
    return {};
};

// Function to save claims
const saveClaims = (claims) => {
    fs.writeJSONSync(CLAIMS_FILE, claims);
};

// Function to check if user can claim
const canUserClaim = (userId, claims) => {
    if (!claims[userId]) return true;
    const lastClaimTime = new Date(claims[userId].timestamp).getTime();
    const currentTime = new Date().getTime();
    return (currentTime - lastClaimTime) >= CLAIM_COOLDOWN;
};

// Function to format time remaining
const formatTimeRemaining = (milliseconds) => {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours} hours and ${minutes} minutes`;
};

console.log('Bot starting...');

bot.command('claim', async (ctx) => {
    const loadingSymbols = ['.', '..', '...', '....', '.....'];
    let loadingIndex = 0;
    let loadingMessage;
    let isLoading = true;

    try {
        const userId = ctx.from.id.toString();
        const claims = loadClaims();

        if (!canUserClaim(userId, claims)) {
            const lastClaimTime = new Date(claims[userId].timestamp).getTime();
            const currentTime = new Date().getTime();
            const timeRemaining = CLAIM_COOLDOWN - (currentTime - lastClaimTime);
            return ctx.reply(`You can only claim every 4 hours! Please try again in ${formatTimeRemaining(timeRemaining)}.`);
        }

        const input = ctx.message.text.split(' ');
        if (input.length !== 2) {
            return ctx.reply('Please use the command in this format: /claim <Solana Address>');
        }

        const recipientAddressString = input[1];
        let recipientAddress;

        try {
            recipientAddress = new PublicKey(recipientAddressString);
        } catch (error) {
            return ctx.reply('Invalid Solana address. Please check and try again.');
        }

        loadingMessage = await ctx.reply('Processing claim...');

        const updateLoader = async () => {
            while (isLoading) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    `Processing claim ${loadingSymbols[loadingIndex]} Please wait...`
                ).catch(console.error);
                loadingIndex = (loadingIndex + 1) % loadingSymbols.length;
                await delay(100);
            }
        };

        updateLoader();

        const minAmount = 6_900_000_0000;
        const maxAmount = 420_000_000;
        const step = 1_000_000; // This is our rounding step (1 million)

        // Calculate the range in terms of steps
        const range = (maxAmount - minAmount) / step;

        // Generate a random number of steps
        const randomSteps = Math.floor(Math.random() * Number(range));

        // Calculate the final amount
        const amount = minAmount + (randomSteps * step);

        // const amount = 6900000n;

        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet,
            MINT_ADDRESS,
            wallet.publicKey
        );

        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet,
            MINT_ADDRESS,
            recipientAddress
        );

        const transaction = new Transaction();

        const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 6000
        });
        transaction.add(priorityFeeInstruction);

        const transferInstruction = createTransferInstruction(
            fromTokenAccount.address,
            toTokenAccount.address,
            wallet.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
        );
        transaction.add(transferInstruction);

        const signature = await connection.sendTransaction(transaction, [wallet]);

        await connection.confirmTransaction(signature);

        isLoading = false;

        // Record the claim
        claims[userId] = {
            address: recipientAddressString,
            timestamp: new Date().toISOString(),
            signature: signature
        };
        saveClaims(claims);

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMessage.message_id,
            null,
            `${amount / 100000} FABS claimed successfully! Transaction signature: https://solana.fm/tx/${signature}`
        );
    } catch (error) {
        console.error('Error claiming tokens:', error);
        isLoading = false;
        if (loadingMessage) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMessage.message_id,
                null,
                'An error occurred while claiming FABS. Please try again later.'
            ).catch(console.error);
        } else {
            ctx.reply('An error occurred while claiming FABS. Please try again later.');
        }
    }
});


console.log('Bot started successfully');

const CHAT_ID = process.env.CHAT_ID || '-4246706171';

bot.telegram.sendMessage(CHAT_ID, '🏃‍♂️‍➡️  FABS Faucet Bot is now online and ready to run! 🏃‍♂️‍➡️')
    .then(() => console.log('Startup message sent to group'))
    .catch(error => console.error('Failed to send startup message:', error));

bot.launch().then(() => console.log('👋 Going for a 🏃‍♂️. Back soon!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));