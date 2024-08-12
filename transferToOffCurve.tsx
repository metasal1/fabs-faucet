const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

async function sendTokensToOffCurveAddress() {
    // Connect to the Solana network
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');

    // Replace with your actual secret key
    const fromWallet = web3.Keypair.fromSecretKey(new Uint8Array([/* your secret key */]));

    // The mint address of the token you want to send
    const mintAddress = new web3.PublicKey('YOUR_TOKEN_MINT_ADDRESS');

    // The off-curve address you want to send tokens to
    const toAddress = new web3.PublicKey('OFF_CURVE_ADDRESS');

    // Amount of tokens to send
    const amount = 100; // Replace with the amount you want to send

    try {
        // Get the token account of the fromWallet address
        const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
            connection,
            fromWallet,
            mintAddress,
            fromWallet.publicKey
        );

        // Create the transfer instruction
        const transferInstruction = splToken.createTransferInstruction(
            fromTokenAccount.address, // source
            toAddress, // destination
            fromWallet.publicKey, // owner
            amount * Math.pow(10, await splToken.getMint(connection, mintAddress).then(info => info.decimals)),
            [],
            splToken.TOKEN_PROGRAM_ID
        );

        // Create a transaction and add the transfer instruction
        const transaction = new web3.Transaction().add(transferInstruction);

        // Sign and send the transaction
        const signature = await web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [fromWallet]
        );

        console.log('Transfer successful! Signature:', signature);
    } catch (error) {
        console.error('Error:', error);
    }
}

sendTokensToOffCurveAddress();