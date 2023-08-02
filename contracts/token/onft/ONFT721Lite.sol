// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT721.sol";
import "./ONFT721CoreLite.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT721Lite is ONFT721CoreLite, ERC721, IONFT721 {
    constructor(string memory _name, string memory _symbol, uint256 _minGasToTransfer, address _lzEndpoint) ERC721(_name, _symbol) ONFT721CoreLite(_minGasToTransfer, _lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT721CoreLite, ERC721, IERC165) returns (bool) {
        return interfaceId == type(IONFT721).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _tokenId) internal virtual override {
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "caller not owner nor approved");
        require(ERC721.ownerOf(_tokenId) == _from, "incorrect owner");
        _transfer(_from, address(this), _tokenId);
    }

    function _creditTo(uint16, address _toAddress, uint _tokenId) internal virtual override {
        require(!_exists(_tokenId) || (_exists(_tokenId) && ERC721.ownerOf(_tokenId) == address(this)));
        if (!_exists(_tokenId)) {
            _safeMint(_toAddress, _tokenId);
        } else {
            _transfer(address(this), _toAddress, _tokenId);
        }
    }
}
