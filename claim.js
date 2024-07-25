import { Telegraf } from 'telegraf';
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection(process.env.RPC, 'confirmed');

const MINT_ADDRESS = new PublicKey('ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('Bot starting...');

bot.command('claim', async (ctx) => {
    const loadingSymbols = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let loadingIndex = 0;
    let loadingMessage;
    let isLoading = true;

    try {
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

        const amount = 6900000n;

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
            microLamports: 10000
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

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMessage.message_id,
            null,
            `Tokens claimed successfully! Transaction signature: https://solana.fm/tx/${signature}`
        );
    } catch (error) {
        console.error('Error claiming tokens:', error);
        isLoading = false;
        if (loadingMessage) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMessage.message_id,
                null,
                'An error occurred while claiming tokens. Please try again later.'
            ).catch(console.error);
        } else {
            ctx.reply('An error occurred while claiming tokens. Please try again later.');
        }
    }
});

console.log('Bot started successfully');

// Replace YOUR_GROUP_CHAT_ID with the actual chat ID of your group
const CHAT_ID = process.env.CHAT_ID || '-4246706171';

bot.telegram.sendMessage(CHAT_ID, 'The FABS Faucet Bot is now online and ready to process requests!')
    .then(() => console.log('Startup message sent to group'))
    .catch(error => console.error('Failed to send startup message:', error));

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));