// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Valueless, six-decimal test collateral. Never deploy as a production asset.
contract MockUSDC is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e6;
    uint256 public constant FAUCET_CAP_PER_ADDRESS = 10_000 * 1e6;
    mapping(address => uint256) public faucetMinted;

    error SupplyCapExceeded();
    error FaucetCapExceeded();

    constructor(address initialOwner) ERC20("Mock USDC (Testnet Only)", "mUSDC") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice Anyone can claim up to the fixed lifetime faucet cap for their address.
    function claimFaucet(uint256 amount) external {
        if (faucetMinted[msg.sender] + amount > FAUCET_CAP_PER_ADDRESS) revert FaucetCapExceeded();
        _mintCapped(msg.sender, amount);
        faucetMinted[msg.sender] += amount;
    }

    /// @notice Testnet operator distribution, still bounded by the hard global supply cap.
    function mint(address to, uint256 amount) external onlyOwner { _mintCapped(to, amount); }

    function _mintCapped(address to, uint256 amount) private {
        if (totalSupply() + amount > MAX_SUPPLY) revert SupplyCapExceeded();
        _mint(to, amount);
    }
}
