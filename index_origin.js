import {} from 'dotenv/config'
import { SOR } from '@balancer-labs/sor';
// import BigNumber from 'bignumber.js';
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { MaxUint256 } from '@ethersproject/constants';
import { Contract } from '@ethersproject/contracts';
import fs from 'fs';

// import relayerAbi from './abi/BatchRelayer.json';

async function makeSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key, KEY=pk_of_wallet_to_swap_with
    const isMainnet = false;

    let provider, WETH, USDC, DAI, chainId, poolsUrl, proxyAddr;

    const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    
    const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using SOR.gasPrice = newPrice
    const gasPrice = BigNumber.from('30000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;
    const MAX_UINT = MaxUint256;
    const deadline = MaxUint256;

    const BatchRelayer = {
        address: '0xdcdbf71A870cc60C6F9B621E28a7D3Ffd6Dd4965',
    };

    if (isMainnet) {
        provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Mainnet WETH
        USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC
        DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
        chainId = 1;
        poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
        proxyAddr = '0x3E66B66Fd1d0b02fDa6C811Da9E0547970DB2f21'; // Mainnet proxy
    } else {
        provider = new JsonRpcProvider(
            `https://kovan.infura.io/v3/${process.env.INFURA}`
        );
        // WETH = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // Kovan WETH
        // USDC = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // Kovan USDC
        WETH = "0xdfcea9088c8a88a76ff74892c1457c17dfeef9c1"; // Kovan WETH
        USDC = '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115'; // Kovan USDC
        DAI = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // Kovan DAI
        chainId = 42;
        poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
        proxyAddr = '0x4e67bf5bD28Dd4b570FBAFe11D0633eCbA2754Ec'; // Kovan proxy
    }

    // const sor = new SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);
    const poolsSource = "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2";
    const sor = new SOR(provider, chainId, poolsSource);

    // This fetches all pools list from URL in constructor then onChain balances using Multicall
    console.log('Fetching pools...');
    let isFetched = await sor.fetchPools([], true);
    console.log(isFetched, 'Pools fetched, get swap info...');

    let tokenIn = WETH;
    let tokenOut = USDC;
    let swapType = 0 //swapExactIn
    let amountIn = BigNumber.from('10000000000000000');

    // Approve WETH for proxy
    const wallet = new Wallet(process.env.KEY, provider);

    const tokenArtifact = JSON.parse(fs.readFileSync("./abi/TestToken.json"));
    const relayerAbi = JSON.parse(fs.readFileSync("./abi/BatchRelayer.json"));
    const vaultArtifact = JSON.parse(fs.readFileSync("./abi/Vault.json"));


    let tokenInContract = new Contract(tokenIn, tokenArtifact.abi, provider);

    tokenInContract = tokenInContract.connect(wallet);
    // console.log('Approving proxy...');
    // let tx = await tokenInContract.approve(proxyAddr, MAX_UINT);
    // let tx = await tokenInContract.approve(vaultAddr, MAX_UINT);
    // console.log(`Approve Tx Hash: ${tx.hash}`);
    // await tx.wait();
    // console.log('Approved.');

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    
    // await sor.setCostOutputToken(tokenOut);

    let swapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
        // {gasPrice, maxPools}
    );

    console.log("swaps----", swapInfo)

    // console.log(`Total Expected Out Of Token: ${amountOut.toString()}`);

    console.log('Exectuting Swap Using Exchange Proxy...');

    // const wallet = new Wallet(process.env.KEY, provider);

    // const proxyArtifact = JSON.parse(fs.readFileSync("./abi/ExchangeProxy.json"));
    // let proxyContract = new Contract(proxyAddr, proxyArtifact.abi, provider);
    // proxyContract = proxyContract.connect(wallet);

    const funds = {
        sender: wallet.address,
        recipient: wallet.address,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    let limits = [];
    swapInfo.tokenAddresses.forEach((token, i) => {
        if (token.toLowerCase() === swapInfo.tokenIn.toLowerCase()) {
            limits[i] = swapInfo.swapAmount.toString();
        } else if (
            token.toLowerCase() === swapInfo.tokenOut.toLowerCase()
        ) {
            limits[i] = swapInfo.returnAmount.mul(-99).div(100).toString();
        } else {
            limits[i] = '0';
        }
    });

    // limits = ['10000000000000000', '0', '0', '0'];

    const overRides = {};
    overRides['gasLimit'] = '450000';
    overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    // if (swapInfo.tokenIn === AddressZero) {
    //     overRides['value'] = swapInfo.swapAmountForSwaps?.toString();
    // }
    
    console.log(`Swapping using address: ${wallet.address}...`);
    console.log(funds)
    console.log(limits)
    const relayerContract = new Contract(BatchRelayer.address, relayerAbi, provider);
    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);

    let tx = await vaultContract
                        .connect(wallet)
                        .batchSwap(
                            swapType,
                            swapInfo.swaps,
                            swapInfo.tokenAddresses,
                            funds,
                            limits,
                            deadline,
                            overRides
                        );


    // let limit = swapInfo.returnAmountFromSwaps.mul(0.99).toString();

    /*
    This first swap is WETH>TOKEN.
    The ExchangeProxy can accept ETH in place of WETH and it will handle wrapping to Weth to make the swap.
    */

    // tx = await proxyContract.multihopBatchSwapExactIn(
    //     swapInfo.swaps,
    //     tokenIn, // Note TokenIn is ETH address and not WETH as we are sending ETH
    //     tokenOut,
    //     amountIn.toString(),
    //     swapInfo.returnAmountFromSwaps.toString(), // This is the minimum amount out you will accept.
    //     // {
    //     //     value: amountIn.toString(), // Here we send ETH in place of WETH
    //     //     gasPrice: gasPrice.toString(),
    //     // }
    // );
    console.log(`Tx Hash: ${tx.hash}`);
    await tx.wait();

        
    /*
    console.log('New Swap, ExactOut...');
    // Now we swap TOKEN>TOKEN & use the swapExactOut swap type to set the exact amount out of tokenOut we want to receive.
    // ExchangeProxy will pull required amount of tokenIn to make swap so tokenIn approval must be set correctly.
    tokenIn = USDC;
    tokenOut = DAI;
    swapType = 'swapExactOut'; // New Swap Type.
    amountOut = new BigNumber(1e18); // This is the exact amount out of tokenOut we want to receive

    // const tokenArtifact = require('./abi/TestToken.json');
    const tokenArtifact = JSON.parse(fs.readFileSync("./abi/TestToken.json"));
    let tokenInContract = new Contract(tokenIn, tokenArtifact.abi, provider);
    tokenInContract = tokenInContract.connect(wallet);
    console.log('Approving proxy...');
    tx = await tokenInContract.approve(proxyAddr, MAX_UINT);
    console.log(`Approve Tx Hash: ${tx.hash}`);
    await tx.wait();
    console.log('Approved.');

    await sor.setCostOutputToken(tokenOut);

    // We want to fetch pools again to make sure onchain balances are correct and we have most accurate swap info
    console.log('Update pool balances...');
    await sor.fetchPools();
    await sor.fetchFilteredPairPools(tokenIn, tokenOut);
    console.log('Pools fetched, get swap info...');

    [swaps, amountIn] = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountOut
    );
    
    console.log("------------------", amountIn)
    console.log("------------------", amountIn.toString())

    console.log(`Required token input amount: ${amountIn.toString()}`);

    console.log('Exectuting Swap Using Exchange Proxy...');

    tx = await proxyContract.multihopBatchSwapExactOut(
        swaps,
        tokenIn,
        tokenOut,
        amountIn.toString(), // This is the max amount of tokenIn you will swap.
        {
            gasPrice: gasPrice.toString(),
        }
    );
    console.log(`Tx Hash: ${tx.hash}`);
    await tx.wait();
    console.log('Check Balances');
    */
}

makeSwap();