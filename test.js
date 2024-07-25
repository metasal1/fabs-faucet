import { Telegraf } from 'telegraf';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection(process.env.RPC, 'confirmed');

const MINT_ADDRESS = new PublicKey('ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);

console.log('bot started')

try {
    const recipientAddress = new PublicKey('GuPGRSTcXkpJ5mY2iaxUmLrCehxXZizTHxTEFwmNWG5t');
    const amount = 690000n; // Adjust based on your token's decimals

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

    const transaction = new Transaction().add(
        createTransferInstruction(
            fromTokenAccount.address,
            toTokenAccount.address,
            wallet.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
        )
    );

    const signature = await connection.sendTransaction(transaction, [wallet]);

    await connection.confirmTransaction(signature);
    console.log(signature)
} catch (error) {
    console.error('Error claiming tokens:', error);
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));