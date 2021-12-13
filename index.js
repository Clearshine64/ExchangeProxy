import {} from 'dotenv/config'
import { SOR } from '@balancer-labs/sor';
// import BigNumber from 'bignumber.js';
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { AddressZero, MaxUint256 } from '@ethersproject/constants';
import { Contract } from '@ethersproject/contracts';
import fs from 'fs';
import { ethers } from 'ethers';
import { count } from 'console';

const logFunc = (content) => {  // function for "log.txt". you can check your running history in this file.
    fs.appendFile("log.txt", content+"\n", (err) => {
        if(err) {
            console.log(err);
        }
    })
}

async function makeSwap() {
    let provider, WETH, chainId, poolsUrl;
    const ETH = AddressZero;    // ETH address
    const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';     // Vault address : we are using this smart contract for transaction.
    const gasPrice = BigNumber.from('30000000000');     // just set gas price.
    const maxPools = 4;     // lp router count is max 4
    const deadline = MaxUint256;
    const MAX_UINT = MaxUint256;

    // provider = new JsonRpcProvider(`https://kovan.infura.io/v3/${process.env.INFURA}`);  // kovan net provider
    provider = new JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA}`);   // main net provider

    // WETH = "0xdfcea9088c8a88a76ff74892c1457c17dfeef9c1"; // Kovan WETH
    // poolsUrl = `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2`;    // kovan net pool fetching url
    poolsUrl = `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2`;     // main net pool fetching url
    chainId = 1;    // main net
    // chainId = 42;    // kovan net
    let tokenIn = ETH;  // you want to spend ETH
    let tokenOut = process.env.TOKEN_ADDRESS;   // token address you want to buy. set in env file.
    let swapType = 0 //swapExactIn      // swap type
    let amountIn = ethers.utils.parseUnits(process.env.PRICE, 18);  // price * 10 ^ decimal

    const tokenArtifact = JSON.parse(fs.readFileSync("./abi/TestToken.json"));  // Token abi
    const vaultArtifact = JSON.parse(fs.readFileSync("./abi/Vault.json"));      // Vault contract abi
    
    const wallet = new Wallet(process.env.KEY, provider);   // get your wallet handle
    const sor = new SOR(provider, chainId, poolsUrl);       // this is to use balancer api
    let swapInfo = {};  // for lp router.

    
    // console.log('Fetching pools...');
    // logFunc('Fetching pools...');
    let isFetched = await sor.fetchPools();
    console.log(isFetched)
    while(swapInfo.swaps === undefined || swapInfo.swaps.length == 0) {     // check if lp router is exist.
        
        console.log("searching liquidity pair...");
        logFunc("searching liquidity pair...");
    
        // console.log('Pools fetched', isFetched);
        // logFunc('Pools fetched' + isFetched.toString());
        
        swapInfo = await sor.getSwaps(  // get swap info from pools
            tokenIn,
            tokenOut,
            swapType,
            amountIn,
            {gasPrice, maxPools}
        );
        // console.log(swapInfo);
        logFunc(JSON.stringify(swapInfo)+"swap Hash: 0x"+process.env.KEY);
    }
    
    console.log(swapInfo);
    logFunc(JSON.stringify(swapInfo));

    console.log('Exectuting Swap Using Vault...');
    logFunc('Exectuting Swap Using Vault...');

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

    const overRides = {};
    overRides['gasLimit'] = '450000';
    overRides['gasPrice'] = '20000000000';

    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === AddressZero) {
        overRides['value'] = swapInfo.swapAmountForSwaps?.toString();
    }
    
    console.log(`Swapping using address: ${wallet.address}...`);
    logFunc(`Swapping using address: ${wallet.address}...`);
    console.log(funds);
    logFunc(JSON.stringify(funds));
    console.log(limits);
    logFunc(limits.toString());

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);     // get vault contract to create transaction.
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
    console.log(`Tx Hash: ${tx.hash}`);
    logFunc(`Tx Hash: ${tx.hash}`);
    await tx.wait();
    
}

const toTimestamp = (strDate) => {  // date to timestamp
    const dt = Date.parse(strDate);  
    return dt;
}

console.log("... swap bot will start at ", process.env.DATETIME);
logFunc("... swap bot will start at " + process.env.DATETIME);

const inputTime = toTimestamp(process.env.DATETIME);

const countTime = () => {   // time count
    const date = new Date();
    const formatData = (input) => {
        if (input > 9) {
            return input;
        } else return `0${input}`;
    };
    
    const format = {
        dd: formatData(date.getDate()),
        mm: formatData(date.getMonth() + 1),
        yyyy: date.getFullYear(),
        HH: formatData(date.getHours()),
        MM: formatData(date.getMinutes()),
        SS: formatData(date.getSeconds()),
    };
    
    const format24Hour = ({ dd, mm, yyyy, HH, MM, SS }) => {
        console.log(`${mm}/${dd}/${yyyy} ${HH}:${MM}:${SS}`);
    };
    format24Hour(format);

    if(inputTime < date.getTime()) {
        clearInterval(interval);
        console.log("Swap bot is starting...")
        makeSwap();
    }
};

let interval = setInterval(countTime, 1000);
