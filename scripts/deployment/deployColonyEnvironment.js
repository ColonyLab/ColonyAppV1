/**
 *  Automates the deployment of whole Colony Environment with default settings
 */

const { setupGovernanceToken } = require("../setupContracts");

async function main() {
    const colonyGovernanceToken = await setupGovernanceToken();
    
    console.log("[ DEPLOYMENT ] Governance Token Contract: ", colonyGovernanceToken.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })