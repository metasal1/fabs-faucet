"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var telegraf_1 = require("telegraf");
// import * as tg from 'node-telegram-bot-api';
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var dotenv = require("dotenv");
var fs_extra_1 = require("fs-extra");
dotenv.config();
var CHAT_ID = process.env.CHAT_ID || '-4246706171';
var bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN || '');
// const bot = new tg(process.env.BOT_TOKEN || '');
var connection = new web3_js_1.Connection(process.env.RPC || (0, web3_js_1.clusterApiUrl)('mainnet-beta'), 'confirmed');
var MINT_ADDRESS = new web3_js_1.PublicKey(process.env.MINT || 'ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
var WALLET_PRIVATE_KEY = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]'));
var wallet = web3_js_1.Keypair.fromSecretKey(WALLET_PRIVATE_KEY);
var delay = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
var CLAIMS_FILE = 'claims.json';
var CLAIM_COOLDOWN = (Number(process.env.COOLDOWN) || 4) * 60 * 60 * 1000; // 24 hours in milliseconds
var checkBurnTransactions = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('Waiting for burn transactions...');
        connection.onLogs(MINT_ADDRESS, function (logsResult) { return __awaiter(void 0, void 0, void 0, function () {
            var burnLog, message;
            return __generator(this, function (_a) {
                if (logsResult.err) {
                    console.error('Error in transaction:', logsResult.err);
                    return [2 /*return*/];
                }
                burnLog = logsResult.logs.find(function (log) { return log.includes('Instruction: Burn'); });
                if (burnLog) {
                    message = "\u2764\uFE0F\u200D\uD83D\uDD25 Somebody just burnt some FABS! \u2764\uFE0F\u200D\uD83D\uDD25\n";
                    bot.telegram.sendMessage(CHAT_ID, message);
                    console.log('Burn detected:', logsResult.signature);
                }
                return [2 /*return*/];
            });
        }); });
        return [2 /*return*/];
    });
}); };
var getSupply = function () { return __awaiter(void 0, void 0, void 0, function () {
    var myHeaders, raw, requestOptions, reply, data, supply;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                myHeaders = new Headers();
                myHeaders.append("Content-Type", "application/json");
                raw = JSON.stringify({
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
                requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: raw
                };
                return [4 /*yield*/, fetch(process.env.RPC || (0, web3_js_1.clusterApiUrl)('mainnet-beta'), requestOptions)];
            case 1:
                reply = _a.sent();
                return [4 /*yield*/, reply.json()];
            case 2:
                data = _a.sent();
                supply = calculateTokenSupply(data.result.token_info.supply, data.result.token_info.decimals);
                console.log("The total supply of FABS is ".concat(supply, " FABS."));
                return [2 /*return*/, supply];
        }
    });
}); };
var getAssetsByOwner = function () { return __awaiter(void 0, void 0, void 0, function () {
    var response, result, item, balance;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch(process.env.RPC, {
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
                })];
            case 1:
                response = _a.sent();
                return [4 /*yield*/, response.json()];
            case 2:
                result = (_a.sent()).result;
                item = result.items.find(function (item) { return item.id === process.env.MINT; });
                balance = calculateTokenSupply(item.token_info.balance, item.token_info.decimals);
                console.log("There is currently ".concat(balance, " FABS in the Bank."));
                return [2 /*return*/, balance];
        }
    });
}); };
bot.command('balance', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var balance;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getAssetsByOwner()];
            case 1:
                balance = _a.sent();
                ctx.reply("There is currently ".concat(balance, " FABS in the Bank."));
                return [2 /*return*/];
        }
    });
}); });
bot.command('ca', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        ctx.reply("FABS fabs.fun\n".concat(process.env.MINT));
        return [2 /*return*/];
    });
}); });
bot.command('dao', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        ctx.reply("DAO\nhttps://app.realms.today/dao/FABS");
        return [2 /*return*/];
    });
}); });
// Function to load claims
var loadClaims = function () {
    if (fs_extra_1.default.existsSync(CLAIMS_FILE)) {
        return fs_extra_1.default.readJSONSync(CLAIMS_FILE);
    }
    return {};
};
// Function to save claims
var saveClaims = function (claims) {
    fs_extra_1.default.writeJSONSync(CLAIMS_FILE, claims);
};
// Function to check if user can claim
var canUserClaim = function (userId, claims) {
    if (!claims[userId])
        return true;
    var lastClaimTime = new Date(claims[userId].timestamp).getTime();
    var currentTime = new Date().getTime();
    return (currentTime - lastClaimTime) >= CLAIM_COOLDOWN;
};
// Function to format time remaining
var formatTimeRemaining = function (milliseconds) {
    var hours = Math.floor(milliseconds / (60 * 60 * 1000));
    var minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    return "".concat(hours, " hours and ").concat(minutes, " minutes");
};
console.log('Bot starting...');
bot.command('supply', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var reply;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getSupply()];
            case 1:
                reply = _a.sent();
                ctx.reply(reply);
                return [2 /*return*/];
        }
    });
}); });
function calculateTokenSupply(rawSupply, decimals) {
    // Convert rawSupply to BigInt to handle large numbers
    var supply = BigInt(rawSupply);
    // Calculate divisor (10 raised to the power of decimals)
    var divisor = BigInt(Math.pow(10, decimals));
    // Perform the division
    var result = Number(supply) / Number(divisor);
    // Round to 0 decimal places and format with commas
    return result.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}
bot.command('holders', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var holders;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getHolders()];
            case 1:
                holders = _a.sent();
                ctx.reply(holders);
                return [2 /*return*/];
        }
    });
}); });
var getHolders = function () { return __awaiter(void 0, void 0, void 0, function () {
    var myHeaders, raw, requestOptions, reply, data, totalHolders, zeroBois, millionaires, billionares, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                myHeaders = new Headers();
                myHeaders.append("Content-Type", "application/json");
                raw = JSON.stringify({
                    "mintAddress": process.env.MINT,
                });
                requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: raw
                };
                return [4 /*yield*/, fetch('https://tokenhodlers.vercel.app/api/getTokenHolders', requestOptions)];
            case 1:
                reply = _a.sent();
                return [4 /*yield*/, reply.json()];
            case 2:
                data = _a.sent();
                totalHolders = data.length;
                zeroBois = data.filter(function (holder) { return holder.balance < 1; }).length;
                millionaires = data.filter(function (holder) { return holder.balance > 1000000000; }).length;
                billionares = data.filter(function (holder) { return holder.balance > 1000000000000000; }).length;
                response = "Total Bank Accounts =  ".concat(totalHolders, "\nEmpty Accounts = ").concat(zeroBois, "\nMillionaires = ").concat(millionaires, "\nBillionaires = ").concat(billionares);
                console.log(response);
                return [2 /*return*/, response];
        }
    });
}); };
bot.command('claim', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var loadingSymbols, loadingIndex, loadingMessage, isLoading, userId, claims, lastClaimTime, currentTime, timeRemaining, input, recipientAddressString, recipientAddress, updateLoader, minAmount, maxAmount, step, range, randomSteps, amount, fromTokenAccount, toTokenAccount, transaction, priorityFeeInstruction, transferInstruction, signature, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                loadingSymbols = ['.', '..', '...', '....', '.....'];
                loadingIndex = 0;
                isLoading = true;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 8, , 12]);
                userId = ctx.from.id.toString();
                claims = loadClaims();
                if (!canUserClaim(userId, claims)) {
                    lastClaimTime = new Date(claims[userId].timestamp).getTime();
                    currentTime = new Date().getTime();
                    timeRemaining = CLAIM_COOLDOWN - (currentTime - lastClaimTime);
                    return [2 /*return*/, ctx.reply("You can only claim every 4 hours! Please try again in ".concat(formatTimeRemaining(timeRemaining), "."))];
                }
                input = ctx.message.text.split(' ');
                if (input.length !== 2) {
                    return [2 /*return*/, ctx.reply('Please use the command in this format: /claim SolanaAddress')];
                }
                recipientAddressString = input[1];
                recipientAddress = void 0;
                try {
                    recipientAddress = new web3_js_1.PublicKey(recipientAddressString);
                }
                catch (error) {
                    return [2 /*return*/, ctx.reply('Invalid Solana Address. Please check and try again.')];
                }
                return [4 /*yield*/, ctx.reply('Processing claim...')];
            case 2:
                loadingMessage = _a.sent();
                updateLoader = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!isLoading) return [3 /*break*/, 3];
                                return [4 /*yield*/, ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, '', "Processing claim".concat(loadingSymbols[loadingIndex], " Please wait...")).catch(console.error)];
                            case 1:
                                _a.sent();
                                loadingIndex = (loadingIndex + 1) % loadingSymbols.length;
                                return [4 /*yield*/, delay(200)];
                            case 2:
                                _a.sent();
                                return [3 /*break*/, 0];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                updateLoader();
                minAmount = Number(process.env.MIN) * 1000 || 690000;
                maxAmount = Number(process.env.MAX) * 1000 || 69000000;
                step = 1000000;
                range = (maxAmount - minAmount) / step;
                randomSteps = Math.floor(Math.random() * Number(range));
                amount = minAmount + (randomSteps * step);
                return [4 /*yield*/, (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, wallet, MINT_ADDRESS, wallet.publicKey)];
            case 3:
                fromTokenAccount = _a.sent();
                return [4 /*yield*/, (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, wallet, MINT_ADDRESS, recipientAddress)];
            case 4:
                toTokenAccount = _a.sent();
                transaction = new web3_js_1.Transaction();
                priorityFeeInstruction = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 10000
                });
                transaction.add(priorityFeeInstruction);
                transferInstruction = (0, spl_token_1.createTransferInstruction)(fromTokenAccount.address, toTokenAccount.address, wallet.publicKey, amount, [], spl_token_1.TOKEN_PROGRAM_ID);
                transaction.add(transferInstruction);
                return [4 /*yield*/, connection.sendTransaction(transaction, [wallet])];
            case 5:
                signature = _a.sent();
                return [4 /*yield*/, connection.confirmTransaction(signature)];
            case 6:
                _a.sent();
                isLoading = false;
                // Record the claim
                claims[userId] = {
                    address: recipientAddressString,
                    timestamp: new Date().toISOString(),
                    signature: signature
                };
                saveClaims(claims);
                return [4 /*yield*/, ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, '', "".concat(amount / 100000, " FABS claimed successfully!\nTransaction signature: https://solana.fm/tx/").concat(signature))];
            case 7:
                _a.sent();
                return [3 /*break*/, 12];
            case 8:
                error_1 = _a.sent();
                console.error('Error claiming tokens:', error_1);
                isLoading = false;
                if (!loadingMessage) return [3 /*break*/, 10];
                return [4 /*yield*/, ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, '', 'An error occurred while claiming FABS.\nPlease try again later.\nRemember - You MUST have at least 1 FABS in your wallet to claim more.').catch(console.error)];
            case 9:
                _a.sent();
                return [3 /*break*/, 11];
            case 10:
                ctx.reply('An error occurred while claiming FABS. Please try again later.');
                _a.label = 11;
            case 11: return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
console.log('Bot started successfully');
bot.telegram.sendMessage(CHAT_ID, '🏦 FABS Bank is now open for business! 🏦')
    .then(function () {
    console.log('Startup message sent to group');
    getSupply();
    getAssetsByOwner();
    getHolders();
    checkBurnTransactions();
})
    .catch(function (error) { return console.error('Failed to send startup message:', error); });
bot.launch().then(function () {
    var bankClosed = ('👋 Going for a 🏃‍♂️. Back soon!');
    bot.telegram.sendMessage(CHAT_ID, bankClosed);
    console.log(bankClosed);
});
process.once('SIGINT', function () { return bot.stop('SIGINT'); });
process.once('SIGTERM', function () { return bot.stop('SIGTERM'); });
