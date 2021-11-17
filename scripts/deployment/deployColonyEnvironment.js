/**
 *  Automates the deployment of whole Colony Environment with default settings
 */

const { setupGovernanceToken, setupVestingContract } = require("../setupContracts");
const { toTokens } = require("../../test/utils/testHelpers");

async function main() {
    const colonyGovernanceToken = await setupGovernanceToken();
    console.log("[ DEPLOYMENT ] Governance Token Contract : ", colonyGovernanceToken.address);

    const colonyVestingContract = await setupVestingContract(colonyGovernanceToken.address);
    console.log("[ DEPLOYMENT ] Vesting Contract          : ", colonyVestingContract.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })