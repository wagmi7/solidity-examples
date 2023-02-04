import * as ethers from "ethers"
import { getDeploymentAddresses, getRpc } from "./readStatic"
import { CHAIN_ID } from "@layerzerolabs/lz-sdk"
import { cli } from "cli-ux"
import { ContractReceipt, Signer } from "ethers"
import { createProvider } from "hardhat/internal/core/providers/construction"
import { DeploymentsManager } from "hardhat-deploy/dist/src/DeploymentsManager"
import EthersAdapter, { EthersAdapterConfig } from "@gnosis.pm/safe-ethers-lib"
import SafeServiceClient from "@gnosis.pm/safe-service-client"
import Safe, { SafeTransactionOptionalProps } from "@gnosis.pm/safe-core-sdk"
import * as dotenv from "dotenv"

const GNOSIS_CONFIG = require("../constants/gnosisConfig.json")
dotenv.config({ path: __dirname + "/.env" })

export function getEndpointId(networkName: string): number {
    return CHAIN_ID[networkName]
}

export interface ExecutableTransaction {
    contractName: string
    methodName: string
    args: any[]
    txArgs?: any
}

export interface Transaction {
    needChange: boolean
    chainId: string
    contractAddress: string
    contractName: string
    methodName: string
    args: any[]
    calldata: string
    diff?: { [key: string]: { newValue: any; oldValue: any } }
}

const getDeploymentManager = (hre, networkName): any => {
    const network: any = {
        name: networkName,
        config: hre.config.networks[networkName],
        provider: createProvider(networkName, hre.config.networks[networkName], hre.config.paths, hre.artifacts),
        saveDeployments: true,
    }
    const newHre = Object.assign(Object.create(Object.getPrototypeOf(hre)), hre)
    newHre.network = network
    const deploymentsManager = new DeploymentsManager(newHre, network)
    newHre.deployments = deploymentsManager.deploymentsExtension
    newHre.getNamedAccounts = deploymentsManager.getNamedAccounts.bind(deploymentsManager)
    newHre.getUnnamedAccounts = deploymentsManager.getUnnamedAccounts.bind(deploymentsManager)
    newHre.getChainId = () => deploymentsManager.getChainId()
    return deploymentsManager
}

export const deployContract = async (hre: any, network: string, tags: string[]) => {
    const deploymentsManager = getDeploymentManager(hre, network)
    await deploymentsManager.runDeploy(tags, {
        log: false, //args.log,
        resetMemory: false,
        writeDeploymentsToFiles: true,
        savePendingTx: false,
    })
}

const providerByNetwork: { [name: string]: ethers.providers.JsonRpcProvider } = {}
export const getProvider = (network: string) => {
    if (!providerByNetwork[network]) {
        let networkUrl = getRpc(network)
        providerByNetwork[network] = new ethers.providers.JsonRpcProvider(networkUrl)
    }
    return providerByNetwork[network]
}

export const getWallet = (index) => {
    return ethers.Wallet.fromMnemonic(process.env.MNEMONIC || "", `m/44'/60'/0'/0/${index}`)
}

const connectedWallets = {}
export const getConnectedWallet = (network, walletIndex) => {
    const key = `${network}-${walletIndex}`
    if (!connectedWallets[key]) {
        const provider = getProvider(network)
        const wallet = getWallet(walletIndex)
        connectedWallets[key] = wallet.connect(provider)
    }
    return connectedWallets[key]
}

const deploymentAddresses: { [key: string]: string } = {}
export const getDeploymentAddress = (network: string, contractName: string) => {
    const key = `${network}-${contractName}`
    if (!deploymentAddresses[key]) {
        deploymentAddresses[key] = getDeploymentAddresses(network)[contractName]
    }
    if (!deploymentAddresses[key]) {
        throw Error(`contract ${key} not found for network: ${network}`)
    }
    return deploymentAddresses[key]
}

const contracts: { [key: string]: any } = {}
export const getContract = async (hre: any, network: string, contractName: string) => {
    if (network == "hardhat") {
        return await hre.ethers.getContract(contractName)
    }

    const key = `${network}-${contractName}`
    if (!contracts[key]) {
        const contractAddress = getDeploymentAddress(network, contractName)
        const provider = getProvider(network)
        const contractFactory = await getContractFactory(hre, contractName)
        const contract = contractFactory.attach(contractAddress)
        contracts[key] = contract.connect(provider)
    }
    return contracts[key]
}

export const getContractAt = async (hre: any, network: string, contractName: string, abi: any, contractAddress: string) => {   
    const key = `${network}-${contractName}`
   
    
    if (!contracts[key]) {
        const provider = getProvider(network)

        const contract = await hre.ethers.getContractAt(abi, contractAddress)
        contracts[key] = contract.connect(provider)
    }
    return contracts[key]
}

export const getWalletContract = async (hre, network, contractName, walletIndex) => {
    const contract = await getContract(hre, network, contractName)
    const wallet = getConnectedWallet(network, walletIndex)
    return contract.connect(wallet)
}

const contractFactories: { [name: string]: ethers.ContractFactory } = {}
const getContractFactory = async (hre: any, contractName: string) => {
    if (!contractFactories[contractName]) {
        contractFactories[contractName] = await hre.ethers.getContractFactory(contractName)
    }
    return contractFactories[contractName]
}

export async function promptToProceed(msg: string, noPrompt: boolean = false) {
    if (!noPrompt) {
        const proceed = await cli.prompt(`${msg} y/N`)
        if (!["y", "yes"].includes(proceed.toLowerCase())) {
            console.log("Aborting...")
            process.exit(0)
        }
    }
}

export const executeTransaction = async (hre: any, network: string, transaction: ExecutableTransaction): Promise<ContractReceipt> => {
    const walletContract = await getWalletContract(hre, network, transaction.contractName, 0)
    const gasPrice = await getProvider(network).getGasPrice()
    const finalGasPrice = gasPrice.mul(10).div(8)

    return await (
        await walletContract[transaction.methodName](...transaction.args, {
            gasPrice: finalGasPrice,
            gasLimit: 8000000,
            ...transaction.txArgs,
        })
    ).wait()
}

// export const executeGnosisTransactions = async (hre: any, network: string, transactions: Transaction[]) => {
//     const signer = (await getConnectedWallet(network, 0)) as Signer
//     const ethAdapter = new EthersAdapter({
//         ethers: hre.ethers,
//         signerOrProvider: signer,
//     })

//     const { safeAddress, url } = GNOSIS_CONFIG[network]

//     const safeService = new SafeServiceClient(url)
//     const safeSdk: Safe = await Safe.create({ ethAdapter, safeAddress })

//     const gnosisTransactions = transactions.map((tx) => {
//         const contractAddress = getDeploymentAddress(network, tx.contractName)
//         return {
//             to: contractAddress,
//             data: tx.calldata,
//             value: "0",
//         }
//     })

//     const nonce = await safeService.getNextNonce(safeAddress)
//     const options: SafeTransactionOptionalProps = {
//         nonce
//     }
//     const safeTransaction = await safeSdk.createTransaction(gnosisTransactions, options)

//     await safeSdk.signTransaction(safeTransaction)
//     const safeTxHash = await safeSdk.getTransactionHash(safeTransaction)
//     await safeService.proposeTransaction({
//         safeAddress,
//         safeTransaction,
//         safeTxHash,
//         senderAddress: signer.address,
//     })
// }
