import { Telegraf } from 'telegraf';
import Anthropic from '@anthropic-ai/sdk';

import { Connection, PublicKey, Keypair, Transaction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import fs from 'fs-extra';

dotenv.config();

const CHAT_ID = process.env.CHAT_ID || '-1002233482852';
const TOPIC_ID = process.env.TOPIC_ID || 5167;
const MINT_ADDRESS = new PublicKey(process.env.MINT || 'ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
const WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]'));
const CLAIMS_FILE = 'claims.json';
const CLAIM_COOLDOWN = (Number(process.env.COOLDOWN) || 6) * 60 * 60 * 1000; // 24 hours in milliseconds
const AI_KEY = process.env.AI_KEY || '';
const AI_SCOPE = process.env.AI_SCOPE || '10 words max';
const GYM_TOPIC_ID = process.env.GYM_TOPIC_ID || '2';

const bot = new Telegraf(process.env.BANK_BOT_TOKEN || '');
const connection = new Connection(process.env.RPC || clusterApiUrl('mainnet-beta'), 'confirmed');
const wallet = Keypair.fromSecretKey(WALLET_PRIVATE_KEY);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const anthropic = new Anthropic({
    apiKey: AI_KEY,
});


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
                bot.telegram.sendMessage(CHAT_ID, message, { message_thread_id: Number(TOPIC_ID) });
                console.log('Burn detected:', logsResult.signature);
            }
        }
    );
}

const checkForNewHolder = async () => {
    console.log('Waiting for NEW Holder transactions...');
    connection.onLogs(
        MINT_ADDRESS,
        async (logs, ctx) => {
            console.log(logs.signature);
            const sig = await connection.getTransaction(logs['signature'], { maxSupportedTransactionVersion: 0 });
            const newHolder = sig?.meta?.postTokenBalances?.[0]?.owner;
            console.log(newHolder ?? 'No owner found');
            const message = `🎉 Welcome to the fam <code>${newHolder}</code>\n`
            bot.telegram.sendMessage(CHAT_ID, message, { message_thread_id: Number(TOPIC_ID), parse_mode: 'HTML' });

        },
        'finalized'
    );
}


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
    const totalHolders = data.totalHolders;
    const zeroBois = data.zeroBoys;
    const millionaires = data.millionairesCount
    const billionares = data.billionairesCount
    const response = `Total Bank Accounts =  ${totalHolders}\nEmpty Accounts = ${zeroBois}\nMillionaires = ${millionaires}\nBillionaires = ${billionares}`;
    console.log(response);
    return response;
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
    const supply = await calculateTokenSupply(data.result.token_info.supply, data.result.token_info.decimals);
    console.log(`The total supply of FABS is ${supply} FABS.`);
    return supply;
}

const getAssetsByOwner = async (address: string): Promise<number> => {

    let addy;
    try {
        addy = new PublicKey(address);
    } catch (e) {
        try {
            const domainWallet = await getDomainWallet(address);
            addy = new PublicKey(domainWallet.result);
        } catch (err) {
            return 0;
        }
    }

    try {
        console.log(`Checking Wallet Address: ${addy}`);
        const raw = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                addy,
                {
                    "mint": "ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE"
                },
                {
                    "encoding": "jsonParsed"
                }
            ]
        });

        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: raw,
        };

        const response = await fetch(process.env.RPC || clusterApiUrl('mainnet-beta'), requestOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        if (!result.result || !result.result.value || result.result.value.length === 0) {
            // throw new Error("No token account found for the given address");
            const message = "No token account found for the given address";
            console.log(message);
            return message;
        }

        const balance = Math.round(result.result.value[0].account.data.parsed.info.tokenAmount.uiAmount);
        console.log(`There are currently ${balance} FABS in the Bank.`);
        return balance;
    } catch (error) {
        console.error(`Couldn't get balance:`, error);
        // throw error; // Re-throw the error for the caller to handle
        return 0;
    }
};
const getSolBalance = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "jsonrpc": "2.0",
        "id": "my-id",
        "method": "getBalance",
        "params": [
            process.env.PK
        ]
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw
    };

    const reply = await fetch(process.env.RPC || clusterApiUrl('mainnet-beta'), requestOptions)
    const data = await reply.json()
    console.log(`Current SOL balance is ${data.result.value / LAMPORTS_PER_SOL} SOL`);
    return data.result.value;
}
const getDomainWallet = async (name) => {
    console.log(`Checking Wallet Address: ${name}`);

    try {
        const isPK = new PublicKey(name);
        if (isPK) {
            return name;
        }
    } catch (e) {
        console.log('Not a public key');
    }

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    let url;
    let data;

    if (name.endsWith('.sol')) {
        url = `https://sns-sdk-proxy.bonfida.workers.dev/resolve/${name}`;
        const reply = await fetch(url);
        data = await reply.json();
        console.log(`Wallet Address for ${name}: ${data.result}`);
    } else {
        url = `https://alldomains.id/api/check-domain/${name}`;
        const response = await fetch(url);
        const responseData = await response.json();

        // Assuming the first item in the 'exists' array is the relevant one
        const domainInfo = responseData.exists[0];

        data = {
            result: domainInfo.owner,
            tld: responseData.tld,
            expiresAt: domainInfo.expiresAt,
            createdAt: domainInfo.createdAt,
            isValid: domainInfo.isValid,
            domainPrice: responseData.domainPrice
        };

        console.log(`Wallet Address for ${name}: ${data.result}`);
    }

    return data;
};

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

const calculateTokenSupply = async (rawSupply, decimals) => {
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

bot.command('start', async (ctx) => {
    ctx.reply(`Welcome to FABS Bank!`);
}
);

bot.command('names', async (ctx) => {
    const url = "https://sns-sdk-proxy.bonfida.workers.dev/subdomains/onlyfabs"
    const myHeaders = new Headers();
    let data;
    myHeaders.append("Content-Type", "application/json");

    const reply = await fetch(url);
    data = await reply.json();
    const message = `Total Registered Names ${data.result.length}`;
    console.log(message);
    ctx.reply(`${message}\nGet your Wallet Name at\nhttps://www.sns.id/sub-registrar/onlyfabs`, { parse_mode: 'HTML' });
});

bot.command('core', async (ctx) => {
    ctx.reply(`Core Team will be announced...!`);
});

// Handler for the /buy command
bot.command('buy', (ctx) => {
    ctx.reply(`To buy our token, please use this link: https://jup.ag/swap/SOL-${MINT_ADDRESS}?referrer=8bbPc25fviwtBdDNR7dxyznp2qxUTKbxGtsougy9w7de&feeBps=100`);
});

// Handler for messages containing 'buy' or 'purchase'
bot.hears(['buy', 'purchase'], (ctx) => {
    ctx.reply(`To buy our token, please use this link: https://jup.ag/swap/SOL-${MINT_ADDRESS}?referrer=8bbPc25fviwtBdDNR7dxyznp2qxUTKbxGtsougy9w7de&feeBps=100`);
});


bot.command('balance', async (ctx) => {

    const input = ctx.message.text.split(' ');
    if (input.length === 1) {
        const balance = await getAssetsByOwner(process.env.PK || 'GuPGRSTcXkpJ5mY2iaxUmLrCehxXZizTHxTEFwmNWG5t');
        ctx.reply(`There is currently ${balance} FABS in the Bank.`);
    }
    else if (input.length === 2) {
        const balance = await getAssetsByOwner(input[1]);
        ctx.reply(`${input[1]} currently has ${balance} FABS.`);
    } else {
        return ctx.reply('Please use the command in this format: /balance address/name');
    }
});

bot.command('ca', async (ctx) => {
    ctx.reply(`Token Mint Address\n<code>${process.env.MINT}</code>`, { parse_mode: 'HTML' });
});

bot.command('website', async (ctx) => {
    ctx.reply(`WEBSITE\nfabs.fun`, { parse_mode: 'HTML' });
});

bot.command('dao', async (ctx) => {
    ctx.reply(`DAO\nhttps://app.realms.today/dao/FABS`);
});

bot.command('supply', async (ctx) => {
    const reply = await getSupply();
    ctx.reply(reply)
});

bot.command('send', async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    console.log("UserId: ", userId);
    try {
        // Get chat member info
        const chatMember = await ctx.getChatMember(userId);

        // Check if the user is an administrator
        if (['creator', 'administrator'].includes(chatMember.status) || userId === 2077314752 || userId === 2214398016 || userId === 136817688) {
            const input = ctx.message.text.split(' ');
            if (input.length !== 3) {
                return ctx.reply('Please use the command in this format: /send amount address/name');
            }

            let amount: number;
            const amountInput = input[1].toUpperCase();
            if (amountInput.endsWith('M')) {
                amount = parseFloat(amountInput.slice(0, -1)) * 1_000_000 * 100000;
            } else if (amountInput.endsWith('K')) {
                amount = parseFloat(amountInput.slice(0, -1)) * 1_000 * 100000;
            } else {
                amount = parseFloat(amountInput) * 100000;
            }

            if (isNaN(amount)) {
                return ctx.reply('Invalid amount. Please provide a valid number, optionally followed by K or M (e.g., 5M for 5 million).');
            }

            let recipientAddress;
            try {
                recipientAddress = new PublicKey(input[2]);
            } catch (e) {
                try {
                    const domainWallet = await getDomainWallet(input[2]);
                    recipientAddress = new PublicKey(domainWallet.result);
                    console.log("Received the following address from the API: ", recipientAddress);
                } catch (err) {
                    return ctx.reply('Invalid Solana Address or Wallet Name. Please check and try again.\nGet your Wallet Name at\nhttps://www.sns.id/sub-registrar/onlyfabs', { parse_mode: 'HTML' });
                }
            }

            ctx.reply(`Sending ${amount / 100000} FABS to ${recipientAddress.toBase58()}`);

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

            // const transaction = new Transaction();

            const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 10000
            });
            // transaction.add(priorityFeeInstruction);

            const transferInstruction = createTransferInstruction(
                fromTokenAccount.address,
                toTokenAccount.address,
                wallet.publicKey,
                amount,
                [],
                TOKEN_PROGRAM_ID
            );
            // transaction.add(transferInstruction);

            // Get the latest blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

            // Create a TransactionMessage
            const message = new TransactionMessage({
                payerKey: wallet.publicKey,
                recentBlockhash: blockhash,
                instructions: [priorityFeeInstruction, transferInstruction]
            }).compileToV0Message();


            // Create a VersionedTransaction
            const transaction = new VersionedTransaction(message);

            // Sign the transaction
            transaction.sign([wallet]);

            // Send the transaction
            const signature = await connection.sendTransaction(transaction);

            // Confirm the transaction
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });
            // const signature = await connection.sendTransaction(transaction, [wallet]);

            // const sign = await connection.confirmTransaction(signature);

            ctx.reply(`Transaction signature: https://solana.fm/tx/${signature}`);
        } else {
            await ctx.reply(`👮‍♀️ Call Security - Someone is trying to rob the bank! ${userId}`);
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        await ctx.reply('An error occurred while processing your request.');
    }
});

bot.command('holders', async (ctx) => {
    const holders = await getHolders();
    ctx.reply(holders);
});

bot.command('gas', async (ctx) => {
    const gas = await getSolBalance();
    ctx.reply(`Current SOL balance for fees is ${gas / LAMPORTS_PER_SOL} SOL`);
})

bot.command('lookup', async (ctx) => {

    const input = ctx.message.text.split(' ');
    if (input.length !== 2) {
        return ctx.reply('Please use the command in this format: /lookup address');
    }

    const address = await getDomainWallet(input[1]);
    ctx.reply(`Wallet Address: <code>${address.result}</code>`, { parse_mode: 'HTML' });
})

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
            return ctx.reply(`You can only claim every ${process.env.COOLDOWN} hours! Please try again in ${formatTimeRemaining(timeRemaining)}.`);
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
                await delay(300);
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

bot.on('message', async (ctx) => {
    console.log(ctx.message);
    if (ctx.message && 'photo' in ctx.message && ctx.message.caption) {
        const caption = ctx.message.caption.toLowerCase();
        if (caption.startsWith('/workout')) {

            let loadingMessage;
            const loadingSymbols = ['🏋️‍♂️', '💪', '🤸‍♂️', '🏃‍♂️', '🚴‍♂️'];
            let loadingIndex = 0;
            let isLoading = true;

            try {
                // Send initial loading message
                loadingMessage = await ctx.reply('Analyzing your workout... 🏋️‍♂️', { message_thread_id: Number(GYM_TOPIC_ID) });

                // Start loading animation
                const updateLoader = async () => {
                    while (isLoading) {
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            loadingMessage.message_id,
                            undefined,
                            `Analyzing your workout... ${loadingSymbols[loadingIndex]}`,
                            { message_thread_id: Number(GYM_TOPIC_ID) }
                        ).catch(console.error);
                        loadingIndex = (loadingIndex + 1) % loadingSymbols.length;
                        await delay(500);
                    }
                };

                updateLoader();

                // Get the file ID of the largest photo
                const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

                // Get the file path
                const file = await ctx.telegram.getFile(fileId);
                const filePath = file.file_path;
                // Download the file
                const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
                console.log(fileUrl)
                const fileResponse = await fetch(fileUrl);
                const imageBuffer = await fileResponse.arrayBuffer();

                // Convert buffer to base64
                const base64Image = Buffer.from(imageBuffer).toString('base64');

                // Prepare the message for the Anthropic API
                const message = [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg', // Telegram usually sends JPEGs
                                    data: base64Image,
                                },
                            },
                            {
                                type: 'text',
                                text: AI_SCOPE,
                            },
                        ],
                    },
                ];

                // Call the Anthropic API
                const response = await anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    max_tokens: 500,
                    messages: message,
                });

                isLoading = false;

                // Send the analysis back to the user
                if (response.content[0].type === 'text') {
                    const aiResponse = response.content[0].text;
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMessage.message_id,
                        undefined,
                        aiResponse,
                        { message_thread_id: Number(GYM_TOPIC_ID) }
                    );

                    // Extract the score from the AI response
                    const scoreMatch = aiResponse.match(/(\d+)/);
                    if (scoreMatch) {
                        const score = parseInt(scoreMatch[0]);
                        const amount = score * 100000; // Convert score to token amount

                        try {
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

                            await ctx.reply(`Congratulations! You've been awarded ${score} FABS for your workout!\nTransaction signature: https://solana.fm/tx/${signature}`, { message_thread_id: Number(GYM_TOPIC_ID) });
                        } catch (error) {
                            console.error('Error sending tokens:', error);
                            await ctx.reply('An error occurred while sending your reward. Please try again later.', { message_thread_id: Number(GYM_TOPIC_ID) });
                        }
                    } else {
                        await ctx.reply('Unable to determine a score from the AI response. No tokens will be sent.', { message_thread_id: Number(GYM_TOPIC_ID) });
                    }
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMessage.message_id,
                        undefined,
                        'Sorry, I couldn\'t generate a text response.',
                        { message_thread_id: Number(GYM_TOPIC_ID) }
                    );
                }
            } catch (error) {
                console.error('Error processing image:', error);
                isLoading = false;
                if (loadingMessage) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMessage.message_id,
                        undefined,
                        'Sorry, there was an error processing your workout image.',
                        { message_thread_id: Number(GYM_TOPIC_ID) }
                    );
                } else {
                    await ctx.reply('Sorry, there was an error processing your workout image.', { message_thread_id: Number(GYM_TOPIC_ID) });
                }
            }
        } else {
            await ctx.reply('Please use the /workout command followed by your wallet address when sending a workout photo.', { message_thread_id: Number(GYM_TOPIC_ID) });
        }
    } else if (ctx.message && 'photo' in ctx.message) {
        await ctx.reply('Please use the /workout command followed by your wallet address when sending a workout photo.', { message_thread_id: Number(GYM_TOPIC_ID) });
    }
});
bot.telegram.sendMessage(CHAT_ID, '🏦 FABS Bank is now open for business! 🏦', { message_thread_id: Number(TOPIC_ID) })
    .then(() => {
        console.log('Startup message sent to group')
        getSupply();
        getAssetsByOwner(process.env.PK || 'GuPGRSTcXkpJ5mY2iaxUmLrCehxXZizTHxTEFwmNWG5t');
        getHolders();
        checkBurnTransactions();
        checkForNewHolder();
    }
    )
    .catch(error => console.error('Failed to send startup message:', error));

bot.launch().then(() => {
    console.log('Bot starting...');
    console.log('Bot started successfully');

});

const sendExitMessage = async () => {
    const exitMessage = `👋 FABS Bank is temporarily closed. We'll be back soon!`;
    try {
        await bot.telegram.sendMessage(CHAT_ID, exitMessage, { message_thread_id: Number(TOPIC_ID) });
        console.log('Exit message sent successfully');
    } catch (error) {
        console.error('Failed to send exit message:', error);
    }
}

// Uncaught exception handler
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await sendExitMessage();
    process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await sendExitMessage();
    process.exit(1);
});

// Modify your existing SIGINT and SIGTERM handlers
process.once('SIGINT', async () => {
    await sendExitMessage();
    bot.stop('SIGINT');
});
