const myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");

const raw = JSON.stringify({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTokenAccountsByOwner",
    "params": [
        "GuPGRSTcXkpJ5mY2iaxUmLrCehxXZizTHxTEFwmNWG5t",
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
    headers: myHeaders,
    body: raw,
    redirect: "follow"
};

try {
    const response = await fetch("https://mainnet.helius-rpc.com/?api-key=ff0d3523-6397-47bf-bf5d-acb7d765d5ff", requestOptions);
    const result = await response.json();
    console.log(Math.round(result.result.value[0].account.data.parsed.info.tokenAmount.uiAmount));
} catch (error) {
    console.error(error);
};