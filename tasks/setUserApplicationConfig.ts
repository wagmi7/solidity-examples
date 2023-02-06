import { getContractAt, Transaction } from "../utils/crossChainHelper"
import { utils, constants } from "ethers"
import { FormatTypes, Interface } from "ethers/lib/utils"

const { LZ_ADDRESS, CHAIN_ID } = require("@layerzerolabs/lz-sdk")
const ENVIRONMENTS = require("../constants/environments.json")
const MAINNET_CONFIG = require("../constants/uaMainnetConfig.json")
const TESTNET_CONFIG = require("../constants/uaTestnetConfig.json")
const UA_ADDRESSES = require("../constants/uaAddresses.json")
const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")

const contractName = "ILayerZeroUserApplicationConfig"
const VERSION = 2

// Application config types from UltraLightNodeV2 contract
const CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION = 1
const CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS = 2
const CONFIG_TYPE_RELAYER = 3
const CONFIG_TYPE_OUTBOUND_PROOF_TYPE = 4
const CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS = 5
const CONFIG_TYPE_ORACLE = 6

const endpointAbi = [
    "function uaConfigLookup(address) view returns (tuple(uint16 sendVersion, uint16 receiveVersion, address receiveLibraryAddress, address sendLibrary))"
]

const uaAbi = [
    "function setConfig(uint16 version, uint16 chainId, uint configType, bytes calldata config)",
    "function setSendVersion(uint16 version)",
    "function setReceiveVersion(uint16 version)"
]

module.exports = async (taskArgs, hre) => {
    // const environment = taskArgs.e
    // let networks
    let config = TESTNET_CONFIG
    // if (environment === "mainnet") {
    //     networks = ENVIRONMENTS[environment]
    //     config = MAINNET_CONFIG
    // } else if (environment === "testnet") {
    //     networks = ENVIRONMENTS[environment]
    //     config = TESTNET_CONFIG
    // } else {
    //     console.log("Invalid environment")
    // 	return
    // }

    const networks = ["goerli", "bsc-testnet", "fuji", "optimism"]
    const localNetworks = networks
    const remoteNetworks = networks

    await Promise.all(localNetworks.map(async (localNetwork) => {
        const transactions: Transaction[] = []
        const uaAddress = UA_ADDRESSES[localNetwork]
        
        if (uaAddress === undefined) return
        
        const endpoint = await getContractAt(hre, localNetwork, "Endpoint", endpointAbi, LZ_ENDPOINTS[localNetwork])
        const ua = await getContractAt(hre, localNetwork, "UserApplication", endpointAbi, uaAddress)
        const chainId = CHAIN_ID[localNetwork]
        const localNetworkConfig = config[localNetwork]
        
        if (localNetworkConfig === undefined) return
        const uaConfig = await endpoint.uaConfigLookup(ua.address)

        if (localNetworkConfig.sendVersion !== undefined) {
            transactions.push(...(await setSendVersion(chainId, ua, uaConfig[0].toNumber(), localNetworkConfig.sendVersion)))
        }

        if (localNetworkConfig.receiveVersion !== undefined) {
            transactions.push(...(await setReceiveVersion(chainId, ua, uaConfig[1].toNumber(), localNetworkConfig.receiveVersion)))
        }

        await Promise.all(remoteNetworks.map(async remoteNetwork => {
            if (localNetwork === remoteNetwork || UA_ADDRESSES[remoteNetwork] === undefined) return
            const remoteChainId = CHAIN_ID[remoteNetwork]

            if (localNetworkConfig.inboundProofLibraryVersion !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION, "uint16", localNetworkConfig.inboundProofLibraryVersion)))
            }

            if (localNetworkConfig.inboundBlockConfirmations !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS, "uint16", localNetworkConfig.inboundBlockConfirmations)))
            }

            if (localNetworkConfig.relayer !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_RELAYER, "address", localNetworkConfig.relayer)))
            }

            if (localNetworkConfig.outboundProofType !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_OUTBOUND_PROOF_TYPE, "uint16", localNetworkConfig.outboundProofType)))
            }

            if (localNetworkConfig.outboundBlockConfirmations !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS, "uint16", localNetworkConfig.outboundBlockConfirmations)))
            }

            if (localNetworkConfig.oracle !== undefined) {
                transactions.push(...(await setConfig(chainId, remoteChainId, ua, CONFIG_TYPE_ORACLE, "address", localNetworkConfig.oracle)))
            }          
        }))
    }))
}

const setSendVersion = async (chainId: string, ua: any, currentSendVersion: any, newSendVersion: any): Promise<Transaction[]> => {
    const needChange = currentSendVersion !== newSendVersion
    const contractAddress = ua.address
    const methodName = "setSendVersion"
    const args = [newSendVersion]
    const calldata = ua.interface.encodeFunctionData(methodName, args)
    const diff = needChange ? { oldValue: currentSendVersion, newValue: newSendVersion } : undefined

    return [{ needChange, chainId, contractName, contractAddress, methodName, args, calldata, diff }]
}

const setReceiveVersion = async (chainId: string, ua: any, currentReceiveVersion: any, newReceiveVersion: any): Promise<Transaction[]> => {
    const needChange = currentReceiveVersion !== newReceiveVersion
    const contractAddress = ua.address
    const methodName = "setReceiveVersion"
    const args = [newReceiveVersion]
    const calldata = ua.interface.encodeFunctionData(methodName, args)
    const diff = needChange ? { oldValue: currentReceiveVersion, newValue: newReceiveVersion } : undefined

    return [{ needChange, chainId, contractName, contractAddress, methodName, args, calldata, diff }]
}

const setConfig = async (chainId: string, remoteChainId: number, ua: any, configType: number, configValueType: string, newValue: any): Promise<Transaction[]> => {
    const currentConfig = await ua.getConfig(VERSION, remoteChainId, constants.AddressZero, configType)
    const oldValue = utils.defaultAbiCoder.decode([configValueType], currentConfig).toString() as any
    const newConfig = utils.defaultAbiCoder.encode([configValueType], [newValue])
    const contractAddress = ua.address
    const methodName = "setConfig"
    const args = [VERSION, remoteChainId, configType, newConfig]
    const needChange = oldValue !== newValue
    const calldata = ua.interface.encodeFunctionData(methodName, args)
    const diff = needChange ? { oldValue, newValue } : undefined

    return [{ needChange, chainId, contractName, contractAddress, methodName, args, calldata, diff }]
}
