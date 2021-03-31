const fs = require('fs')

const OUTPUT_FILE = './mainnetDeployment/mainnetDeploymentOutput.json'

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class MainnetDeploymentHelper {

    static loadPreviousDeployment() {
        let previousDeployment = {}
        if (fs.existsSync(OUTPUT_FILE)) {
            console.log(`Loading previous deployment...`)
            previousDeployment = require('../' + OUTPUT_FILE)
        }

        return previousDeployment
    }

    static saveDeployment(deploymentState) {
        const deploymentStateJSON = JSON.stringify(deploymentState, null, 2)
        fs.writeFileSync(OUTPUT_FILE, deploymentStateJSON)

    }
    // --- Deployer methods ---

    static async getFactory(name, wallet) {
	const factory = await ethers.getContractFactory(name, wallet)
	return factory
    }

    static async loadOrDeploy(factory, name, deployerWallet, deploymentState, params=[]) {
        if (deploymentState[name] && deploymentState[name].address) {
            console.log(`Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
            return new ethers.Contract(
                deploymentState[name].address,
                factory.interface,
                deployerWallet
            );
        }

        const contract = await factory.deploy(...params)

        deploymentState[name] = {
            address: contract.address,
            txHash: contract.deployTransaction.hash
        }

        this.saveDeployment(deploymentState)

        return contract
    }

    static async deployLiquityCoreMainnet(deployerWallet, tellorMasterAddr, deploymentState) {
	// Get contract factories
	const priceFeedFactory = await this.getFactory("PriceFeed", deployerWallet)
	const sortedTrovesFactory = await this.getFactory("SortedTroves", deployerWallet)
	const troveManagerFactory = await this.getFactory("TroveManager", deployerWallet)
	const activePoolFactory = await this.getFactory("ActivePool", deployerWallet)
	const stabilityPoolFactory = await this.getFactory("StabilityPool", deployerWallet)
	const gasPoolFactory = await this.getFactory("GasPool", deployerWallet)
	const defaultPoolFactory = await this.getFactory("DefaultPool", deployerWallet)
	const collSurplusPoolFactory = await this.getFactory("CollSurplusPool", deployerWallet)
	const borrowerOperationsFactory = await this.getFactory("BorrowerOperations", deployerWallet)
	const hintHelpersFactory = await this.getFactory("HintHelpers", deployerWallet)
	const lusdTokenFactory = await this.getFactory("LUSDToken", deployerWallet)
	const tellorCallerFactory = await this.getFactory("TellorCaller", deployerWallet)

	// Deploy txs
	const priceFeed = await this.loadOrDeploy(priceFeedFactory, 'priceFeed', deployerWallet, deploymentState)
	const sortedTroves = await this.loadOrDeploy(sortedTrovesFactory, 'sortedTroves', deployerWallet, deploymentState)
	const troveManager = await this.loadOrDeploy(troveManagerFactory, 'troveManager', deployerWallet, deploymentState)
	const activePool = await this.loadOrDeploy(activePoolFactory, 'activePool', deployerWallet, deploymentState)
	const stabilityPool = await this.loadOrDeploy(stabilityPoolFactory, 'stabilityPool', deployerWallet, deploymentState)
	const gasPool = await this.loadOrDeploy(gasPoolFactory, 'gasPool', deployerWallet, deploymentState)
	const defaultPool = await this.loadOrDeploy(defaultPoolFactory, 'defaultPool', deployerWallet, deploymentState)
	const collSurplusPool = await this.loadOrDeploy(collSurplusPoolFactory, 'collSurplusPool', deployerWallet, deploymentState)
	const borrowerOperations = await this.loadOrDeploy(borrowerOperationsFactory, 'borrowerOperations', deployerWallet, deploymentState)
	const hintHelpers = await this.loadOrDeploy(hintHelpersFactory, 'hintHelpers', deployerWallet, deploymentState)
	const tellorCaller = await this.loadOrDeploy(tellorCallerFactory, 'tellorCaller', deployerWallet, deploymentState, [tellorMasterAddr])

	const lusdToken = await this.loadOrDeploy(
            lusdTokenFactory,
            'lusdToken',
            deployerWallet,
            deploymentState,
            [
	        troveManager.address,
	        stabilityPool.address,
	        borrowerOperations.address
            ]
	)

	const coreContracts = {
	    priceFeed,
	    lusdToken,
	    sortedTroves,
	    troveManager,
	    activePool,
	    stabilityPool,
	    gasPool,
	    defaultPool,
	    collSurplusPool,
	    borrowerOperations,
	    hintHelpers,
	    tellorCaller
	}
	return coreContracts
    }

    static async deployLQTYContractsMainnet(bountyAddress, lpRewardsAddress, multisigAddress, deployerWallet, deploymentState) {
        const lqtyStakingFactory = await this.getFactory("LQTYStaking", deployerWallet)
        const lockupContractFactory_Factory = await this.getFactory("LockupContractFactory", deployerWallet)
        const communityIssuanceFactory = await this.getFactory("CommunityIssuance", deployerWallet)
        const lqtyTokenFactory = await this.getFactory("LQTYToken", deployerWallet)

        const lqtyStaking = await this.loadOrDeploy(lqtyStakingFactory, 'lqtyStaking', deployerWallet, deploymentState)
        const lockupContractFactory = await this.loadOrDeploy(lockupContractFactory_Factory, 'lockupContractFactory', deployerWallet, deploymentState)
        const communityIssuance = await this.loadOrDeploy(communityIssuanceFactory, 'communityIssuance', deployerWallet, deploymentState)
        
        // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor 
        const lqtyToken = await lqtyTokenFactory.deploy(
            communityIssuance.address, 
            lqtyStaking.address,
            lockupContractFactory.address,
            bountyAddress,
            lpRewardsAddress,
            multisigAddress
        )
        
        const LQTYContracts = {
            lqtyStaking,
            lockupContractFactory,
            communityIssuance,
            lqtyToken
        }
        return LQTYContracts
    }

    static async deployUnipoolMainnet(deployerWallet, deploymentState) {
        const unipoolFactory = await this.getFactory("Unipool", deployerWallet)
        const unipool = await this.loadOrDeploy(unipoolFactory, 'unipool', deployerWallet, deploymentState)

        return unipool
    }

    // --- Connector methods ---

    static async isOwnershipRenounced(contract) {
        const owner = await contract.owner()
        return owner == ZERO_ADDRESS
    }
    // Connect contracts to their dependencies
    static async connectCoreContractsMainnet(contracts, LQTYContracts, chainlinkProxyAddress) {
        // Set ChainlinkAggregatorProxy and TellorCaller in the PriceFeed
        await this.isOwnershipRenounced(contracts.priceFeed) ||
            await contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.tellorCaller.address)

        // set TroveManager addr in SortedTroves
        await this.isOwnershipRenounced(contracts.sortedTroves) ||
            await contracts.sortedTroves.setParams(
                maxBytes32,
                contracts.troveManager.address,
                contracts.borrowerOperations.address
            )

        // set contracts in the Trove Manager
        await this.isOwnershipRenounced(contracts.troveManager) ||
            await contracts.troveManager.setAddresses(
                contracts.borrowerOperations.address,
                contracts.activePool.address,
                contracts.defaultPool.address,
                contracts.stabilityPool.address,
                contracts.gasPool.address,
                contracts.collSurplusPool.address,
                contracts.priceFeed.address,
                contracts.lusdToken.address,
                contracts.sortedTroves.address,
                LQTYContracts.lqtyToken.address,
                LQTYContracts.lqtyStaking.address
            )

        // set contracts in BorrowerOperations 
        await this.isOwnershipRenounced(contracts.borrowerOperations) ||
            await contracts.borrowerOperations.setAddresses(
                contracts.troveManager.address,
                contracts.activePool.address,
                contracts.defaultPool.address,
                contracts.stabilityPool.address,
                contracts.gasPool.address,
                contracts.collSurplusPool.address,
                contracts.priceFeed.address,
                contracts.sortedTroves.address,
                contracts.lusdToken.address,
                LQTYContracts.lqtyStaking.address
            )

        // set contracts in the Pools
        await this.isOwnershipRenounced(contracts.stabilityPool) ||
            await contracts.stabilityPool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.activePool.address,
                contracts.lusdToken.address,
                contracts.sortedTroves.address,
                contracts.priceFeed.address,
                LQTYContracts.communityIssuance.address
            )

        await this.isOwnershipRenounced(contracts.activePool) ||
            await contracts.activePool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.stabilityPool.address,
                contracts.defaultPool.address
            )

        await this.isOwnershipRenounced(contracts.defaultPool) ||
            await contracts.defaultPool.setAddresses(
                contracts.troveManager.address,
                contracts.activePool.address,
            )

        await this.isOwnershipRenounced(contracts.collSurplusPool) ||
            await contracts.collSurplusPool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.activePool.address,
            )

        // set contracts in HintHelpers
        await this.isOwnershipRenounced(contracts.hintHelpers) ||
            await contracts.hintHelpers.setAddresses(
                contracts.sortedTroves.address,
                contracts.troveManager.address
            )
    }

    static async connectLQTYContractsMainnet(LQTYContracts) {
        // Set LQTYToken address in LCF
        await LQTYContracts.lockupContractFactory.setLQTYTokenAddress(LQTYContracts.lqtyToken.address)
    }

    static async connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts) {
        await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
            await LQTYContracts.lqtyStaking.setAddresses(
                LQTYContracts.lqtyToken.address,
                coreContracts.lusdToken.address,
                coreContracts.troveManager.address, 
                coreContracts.borrowerOperations.address,
                coreContracts.activePool.address
            )

        await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
            await LQTYContracts.communityIssuance.setAddresses(
                LQTYContracts.lqtyToken.address,
                coreContracts.stabilityPool.address
            )
    }

    static async connectUnipoolMainnet(uniPool, LQTYContracts, LUSDWETHPairAddr, duration) {
        await this.isOwnershipRenounced(uniPool) ||
            await uniPool.setParams(LQTYContracts.lqtyToken.address, LUSDWETHPairAddr, duration)
    }

    // --- Helpers ---

    static async logContractObjects (contracts) {
        console.log(`Contract objects addresses:`)
        for ( const contractName of Object.keys(contracts)) {
            console.log(`${contractName}: ${contracts[contractName].address}`);
        }
    }
}

module.exports = MainnetDeploymentHelper
