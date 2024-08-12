import { Connection, PublicKey } from '@solana/web3.js';

async function monitorNewATAs(tokenMintAddress) {
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=ff0d3523-6397-47bf-bf5d-acb7d765d5ff');
    const mint = new PublicKey(tokenMintAddress);

    console.log(`Monitoring new ATAs for token mint: ${tokenMintAddress}`);

    connection.onLogs(
        mint,
        async (logs, ctx) => {
            console.log(logs.signature);
            const sig = await connection.getTransaction(logs['signature'], { maxSupportedTransactionVersion: 0 });
            console.log(sig?.meta?.postTokenBalances?.[0]?.owner ?? 'No owner found');
        },
        'finalized'
    );
}

// Usage
// monitorNewATAs('ErbakSHZWeLnq1hsqFvNz8FvxSzggrfyNGB6TEGSSgNE');
monitorNewATAs('Cofigb7owgTHfvZESmHYMYjXRMQiJCfEwENmkxJp5ugD')