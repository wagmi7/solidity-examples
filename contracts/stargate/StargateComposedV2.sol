// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IStargateRouter.sol";
import "../interfaces/IStargateReceiver.sol";

contract StargateComposedV2 is IStargateReceiver {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IStargateRouter public immutable stargateRouter;
    IERC20 public immutable usdToken;

    constructor(address _stargateRouter, address _usdcToken) {
        stargateRouter = IStargateRouter(_stargateRouter);
        usdToken = IERC20(_usdcToken);
    }

    function deposit(
        uint qty,
        address bridgeToken,                    // the address of the native ERC20 to swap() - *must* be the token for the poolId
        uint16 dstChainId,                      // Stargate/LayerZero chainId
        uint16 srcPoolId,                       // stargate poolId - *must* be the poolId for the qty asset
        uint16 dstPoolId,                       // stargate destination poolId
        address to,                             // the address to send the destination tokens to
        address destStargateComposed            // destination contract. it must implement sgReceive()
    ) external payable {
        require(msg.value > 0, "stargate requires a msg.value to pay crosschain message");
        require(qty > 0, 'error: swap() requires qty > 0');

        // this contract calls stargate swap() with 20% of desired amount
        IERC20(bridgeToken).transferFrom(msg.sender, address(this), qty);
        IERC20(bridgeToken).approve(address(stargateRouter), qty * 20000 / 100000);

        // TODO extra logic to enforce poolIds match the bridgeToken

        // Stargate's Router.swap() function sends the tokens to the destination chain.
        IStargateRouter(stargateRouter).swap{value:msg.value}(
            dstChainId,                                     // the destination chain id
            srcPoolId,                                      // the source Stargate poolId
            dstPoolId,                                      // the destination Stargate poolId
            payable(msg.sender),                            // refund address. if msg.sender pays too much gas, return extra eth
            qty * 20000 / 100000,                           // total tokens to send to destination chain
            0,                                              // min amount allowed out
            IStargateRouter.lzTxObj(200000, 0, "0x"),       // default lzTxObj
            abi.encodePacked(destStargateComposed),         // destination address, the sgReceive() implementer
            abi.encode(to)                                  // encode payload data to send to destination contract, which it will handle with sgReceive()
        );
    }

    function processRewards(
        uint qty,
        address rewardToken,                    // the address of the native ERC20 to swap() - *must* be the token for the poolId
        uint16 dstChainId,                      // Stargate/LayerZero chainId
        uint16 srcPoolId,                       // stargate poolId - *must* be the poolId for the qty asset
        uint16 dstPoolId,                       // stargate destination poolId
        address to,                             // the address to send the destination tokens to
        address destStargateComposed            // destination contract. it must implement sgReceive()
    ) external payable {
        require(msg.value > 0, "stargate requires a msg.value to pay crosschain message");
        require(qty > 0, 'error: swap() requires qty > 0');

        // encode payload data to send to destination contract, which it will handle with sgReceive()
        bytes memory data = abi.encode(to);

        IERC20(rewardToken).transferFrom(msg.sender, address(this), qty);
        IERC20(rewardToken).approve(address(stargateRouter), qty);

        // TODO extra logic to enforce poolIds match the bridgeToken

        // Stargate's Router.swap() function sends the tokens to the destination chain.
        IStargateRouter(stargateRouter).swap{value:msg.value}(
            dstChainId,                                     // the destination chain id
            srcPoolId,                                      // the source Stargate poolId
            dstPoolId,                                      // the destination Stargate poolId
            payable(msg.sender),                            // refund address. if msg.sender pays too much gas, return extra eth
            qty,                                            // total tokens to send to destination chain
            0,                                              // min amount allowed out
            IStargateRouter.lzTxObj(200000, 0, "0x"),       // default lzTxObj
            abi.encodePacked(destStargateComposed),         // destination address, the sgReceive() implementer
            data                                            // bytes payload
        );
    }

    //-----------------------------------------------------------------------------------------------------------------------
    // sgReceive() - the destination contract must implement this function to receive the tokens and payload
    function sgReceive(
        uint16 /*_chainId*/,
        bytes memory /*_srcAddress*/,
        uint /*_nonce*/,
        address _token,
        uint _amountLD,
        bytes memory _payload
    ) override external {
        require(msg.sender == address(stargateRouter), "only stargate router can call sgReceive!");
        (address _toAddress) = abi.decode(_payload, (address));
        IERC20(_token).transfer(_toAddress, _amountLD);
    }

//    // should follow a similar implementation to redeemLocal() A-> B-> A from stargate
//    // https://github.com/stargate-protocol/stargate/blob/main/contracts/Router.sol#L172
//    function withdraw() external {
//         request funds from other chain if not enough here to withdraw
//    }
}
