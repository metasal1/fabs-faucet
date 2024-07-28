import { Telegraf } from 'telegraf';
// import * as tg from 'node-telegram-bot-api';
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram, clusterApiUrl } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';
import fs from 'fs-extra';

dotenv.config();

const CHAT_ID = process.env.CHAT_ID || '-4246706171';
const bot = new Telegraf(process.env.BOT_TOKEN || '');
// const bot = new tg(process.env.BOT_TOKEN || '');
const connection = new Connection(process.env.RPC || clusterApiUrl('mainnet-beta'), 'confirmed');

const MINT_ADDRESS = new PublicKey(process.env.MINT || 'ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]'));
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CLAIMS_FILE = 'claims.json';
const CLAIM_COOLDOWN = (Number(process.env.COOLDOWN) || 4) * 60 * 60 * 1000; // 24 hours in milliseconds

const checkBurnTransactions = async () => {
    console.log('Waiting for burn transactions...');
    connection.onLogs(
        MINT_ADDRESS,
        async (logsResult) => {
            if (logsResult.err) {
                console.error('Error in transaction:', logsResult.err);
                return;
            }
            const burnLog = logsResult.logs.find(log => log.includes('Instruction: Burn'));
            if (burnLog) {
                const message = `❤️‍🔥 Somebody just burnt some FABS! ❤️‍🔥\n`
                bot.telegram.sendMessage(CHAT_ID, message);
                console.log('Burn detected:', logsResult.signature);
            }
        }
    );
}

const getSupply = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "jsonrpc": "2.0",
        "id": process.env.RPC,
        "method": "getAsset",
        "params": {
            "id": process.env.MINT,
            "options": {
                "showFungible": false,
                "showInscription": false
            }
        }
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw
    };

    const reply = await fetch(process.env.RPC || clusterApiUrl('mainnet-beta'), requestOptions)
    const data = await reply.json()
    const supply = calculateTokenSupply(data.result.token_info.supply, data.result.token_info.decimals);
    console.log(`The total supply of FABS is ${supply} FABS.`);
    return supply;
}
const getAssetsByOwner = async () => {
    const response = await fetch(process.env.RPC, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAssetsByOwner',
            params: {
                ownerAddress: process.env.PK,
                page: 1, // Starts at 1
                limit: 1000,
                displayOptions: {
                    showFungible: true //return both fungible and non-fungible tokens
                }
            },
        }),
    });
    const { result } = await response.json();
    const item = result.items.find(item => item.id === process.env.MINT);
    const balance = calculateTokenSupply(item.token_info.balance, item.token_info.decimals);
    console.log(`There is currently ${balance} FABS in the Bank.`);
    return balance;
};


bot.command('balance', async (ctx) => {
    const balance = await getAssetsByOwner();
    ctx.reply(`There is currently ${balance} FABS in the Bank.`);
});

bot.command('ca', async (ctx) => {
    ctx.reply(`FABS fabs.fun\n${process.env.MINT}`);
});

bot.command('dao', async (ctx) => {
    ctx.reply(`DAO\nhttps://app.realms.today/dao/FABS`);
});
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

bot.command('supply', async (ctx) => {
    const reply = await getSupply();
    ctx.reply(reply)
});

function calculateTokenSupply(rawSupply, decimals) {
    // Convert rawSupply to BigInt to handle large numbers
    const supply = BigInt(rawSupply);

    // Calculate divisor (10 raised to the power of decimals)
    const divisor = BigInt(10 ** decimals);

    // Perform the division
    const result = Number(supply) / Number(divisor);

    // Round to 0 decimal places and format with commas
    return result.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

bot.command('holders', async (ctx) => {
    const holders = await getHolders();
    ctx.reply(holders);
});
const getHolders = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "mintAddress": process.env.MINT,
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw
    };

    const reply = await fetch('https://tokenhodlers.vercel.app/api/getTokenHolders', requestOptions)
    const data = await reply.json()
    const totalHolders = data.length;
    const zeroBois = data.filter(holder => holder.balance < 1).length;
    const millionaires = data.filter(holder => holder.balance > 1_000_000_000).length;
    const billionares = data.filter(holder => holder.balance > 1_000_000_000_000_000).length;
    const response = `Total Bank Accounts =  ${totalHolders}\nEmpty Accounts = ${zeroBois}\nMillionaires = ${millionaires}\nBillionaires = ${billionares}`;
    console.log(response);
    return response;
}

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
            return ctx.reply('Please use the command in this format: /claim SolanaAddress');
        }

        const recipientAddressString = input[1];
        let recipientAddress;

        try {
            recipientAddress = new PublicKey(recipientAddressString);
        } catch (error) {
            return ctx.reply('Invalid Solana Address. Please check and try again.');
        }

        loadingMessage = await ctx.reply('Processing claim...');

        const updateLoader = async () => {
            while (isLoading) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    '',
                    `Processing claim${loadingSymbols[loadingIndex]} Please wait...`
                ).catch(console.error);
                loadingIndex = (loadingIndex + 1) % loadingSymbols.length;
                await delay(200);
            }
        };

        updateLoader();

        const minAmount = Number(process.env.MIN) * 1000 || 690_000;
        const maxAmount = Number(process.env.MAX) * 1000 || 69_000_000;
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
            '',
            `${amount / 100000} FABS claimed successfully!\nTransaction signature: https://solana.fm/tx/${signature}`
        );
    } catch (error) {
        console.error('Error claiming tokens:', error);
        isLoading = false;
        if (loadingMessage) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMessage.message_id,
                '',
                'An error occurred while claiming FABS.\nPlease try again later.\nRemember - You MUST have at least 1 FABS in your wallet to claim more.'
            ).catch(console.error);
        } else {
            ctx.reply('An error occurred while claiming FABS. Please try again later.');
        }
    }
});

console.log('Bot started successfully');

bot.telegram.sendMessage(CHAT_ID, '🏦 FABS Bank is now open for business! 🏦')
    .then(() => {
        console.log('Startup message sent to group')
        getSupply();
        getAssetsByOwner();
        getHolders();
        checkBurnTransactions();
    }
    )
    .catch(error => console.error('Failed to send startup message:', error));


bot.launch().then(() => console.log('👋 Going for a 🏃‍♂️. Back soon!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));