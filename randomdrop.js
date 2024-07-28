import { Telegraf } from 'telegraf';
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';
import fs from 'fs-extra';
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection(process.env.RPC, 'confirmed');
const MINT_ADDRESS = new PublicKey(process.env.MINT);
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);

// Function to format time remaining
const formatTimeRemaining = (milliseconds) => {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours} hours and ${minutes} minutes`;
};

console.log('Bot starting...');

bot.command('holders', async (ctx) => {
    const holders = await getHolders();
    ctx.reply(holders);
});

const sendTokensToRandomHolderUnder100M = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "mintAddress": process.env.MINT,
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    const reply = await fetch('https://tokenhodlers.vercel.app/api/getTokenHolders', requestOptions)
    const data = await reply.json()

    // Filter holders with less than 100 million tokens
    const eligibleHolders = data.filter(holder => holder.balance < 100_000_000);

    if (eligibleHolders.length === 0) {
        console.log("No eligible holders found.");
        return null;
    }

    // Select a random holder
    const randomHolder = eligibleHolders[Math.floor(Math.random() * eligibleHolders.length)];
    console.log(`Selected holder: ${randomHolder.address} with ${randomHolder.balance} tokens`);
    console.log(randomHolder);

    // Generate a random amount of tokens to send (e.g., between 1 and 1000)
    const tokensToSend = Math.floor(Math.random() * 1000) + 1000;

    // Here you would implement the actual token transfer
    const tx = await transferTokens(randomHolder.address, tokensToSend);
    console.log(`Sent ${tokensToSend} tokens to ${randomHolder.address}`);
    return randomHolder;

}
console.log('Bot started successfully');

const CHAT_ID = process.env.CHAT_ID || '-4246706171';

bot.telegram.sendMessage(CHAT_ID, '🧧 FABS Lucky Bot is READY to RUN! 🧧')
    .then(() => {
        console.log('Startup message sent to group')
        sendTokensToRandomHolderUnder100M();
    }
    )
    .catch(error => console.error('Failed to send startup message:', error));

bot.launch().then(() => console.log('👋 Going for a 🏃‍♂️. Back soon!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const transferTokens = async (recipient, amount) => {

    const transaction = new Transaction();

    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000
    });
    transaction.add(priorityFeeInstruction);

    const transferInstruction = createTransferInstruction(
        wallet.publicKey,
        recipient,
        wallet.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID
    );
    transaction.add(transferInstruction);

    const signature = await connection.sendTransaction(transaction, [wallet]);

    await connection.confirmTransaction(signature);
    console.log(`Sent ${amount} tokens to ${recipientAddress}`);
}