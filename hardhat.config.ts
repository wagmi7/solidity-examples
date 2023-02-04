import { HardhatUserConfig } from "hardhat/types"
import "@nomiclabs/hardhat-solhint"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-deploy"
import "hardhat-deploy-ethers"
import "hardhat-gas-reporter"
import "solidity-coverage"
import "./tasks"
import * as dotenv from "dotenv"
dotenv.config({ path: __dirname + "/.env" })

function getMnemonic(networkName: string | undefined) {
    if (networkName) {
        const mnemonic = process.env["MNEMONIC_" + networkName.toUpperCase()]
        if (mnemonic && mnemonic !== "") {
            return mnemonic
        }
    }

    const mnemonic = process.env.MNEMONIC
    if (!mnemonic || mnemonic === "") {
        return "test test test test test test test test test test test junk"
    }

    return mnemonic
}

function accounts(chainKey: string | undefined = undefined) {
    return { mnemonic: getMnemonic(chainKey) }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.4",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },

    namedAccounts: {
        deployer: {
            default: 0, // wallet address 0, of the mnemonic in .env
        },
        proxyOwner: {
            default: 1,
        },
    },

    networks: {
        ethereum: {
            url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // public infura endpoint
            chainId: 1,
            accounts: accounts(),
        },
        bsc: {
            url: "https://bsc-dataseed1.binance.org",
            chainId: 56,
            accounts: accounts(),
        },
        avalanche: {
            url: "https://api.avax.network/ext/bc/C/rpc",
            chainId: 43114,
            accounts: accounts(),
        },
        polygon: {
            url: "https://rpc-mainnet.maticvigil.com",
            chainId: 137,
            accounts: accounts(),
        },
        arbitrum: {
            url: `https://arb1.arbitrum.io/rpc`,
            chainId: 42161,
            accounts: accounts(),
        },
        optimism: {
            url: `https://mainnet.optimism.io`,
            chainId: 10,
            accounts: accounts(),
        },
        fantom: {
            url: `https://rpcapi.fantom.network`,
            chainId: 250,
            accounts: accounts(),
        },

        goerli: {
            url: "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // public infura endpoint
            chainId: 5,
            accounts: accounts(),
        },
        "bsc-testnet": {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            chainId: 97,
            accounts: accounts(),
        },
        fuji: {
            url: `https://api.avax-test.network/ext/bc/C/rpc`,
            chainId: 43113,
            accounts: accounts(),
        },
        mumbai: {
            url: "https://rpc-mumbai.maticvigil.com/",
            chainId: 80001,
            accounts: accounts(),
        },
        "arbitrum-goerli": {
            url: `https://goerli-rollup.arbitrum.io/rpc/`,
            chainId: 421613,
            accounts: accounts(),
        },
        "optimism-goerli": {
            url: `https://goerli.optimism.io/`,
            chainId: 420,
            accounts: accounts(),
        },
        "fantom-testnet": {
            url: `https://rpc.testnet.fantom.network/`,
            chainId: 4002,
            accounts: accounts(),
        },
    },
}

export default config
