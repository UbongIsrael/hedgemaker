// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";

/// @notice Discoverable role identifiers for the shared HedgeMaker authority.
/// @dev AccessManager's initial admin retains its standard ADMIN_ROLE. Deployment
///      scripts assign these roles to selectors and operational accounts.
contract HedgeMakerAccessManager is AccessManager {
    uint64 public constant CONFIG_ROLE = 1;
    uint64 public constant PAUSER_ROLE = 2;
    uint64 public constant ORACLE_POLICY_ROLE = 3;
    uint64 public constant TREASURY_ROLE = 4;

    constructor(address initialAdmin) AccessManager(initialAdmin) {}
}
