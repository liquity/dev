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

    static async sendAndWaitForTransaction(mainnetProvider, txPromise) {
        const tx = await txPromise
        const minedTx = await mainnetProvider.waitForTransaction(tx.hash)

        return minedTx
    }

    static async loadOrDeploy(factory, name, deployerWallet, deploymentState, gasPrice, params=[]) {
        if (deploymentState[name] && deploymentState[name].address) {
            console.log(`Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
            return new ethers.Contract(
                deploymentState[name].address,
                factory.interface,
                deployerWallet
            );
        }

        const contract = await factory.deploy(...params, {gasPrice})
        await deployerWallet.provider.waitForTransaction(contract.deployTransaction.hash)

        deploymentState[name] = {
            address: contract.address,
            txHash: contract.deployTransaction.hash
        }

        this.saveDeployment(deploymentState)

        return contract
    }

    static async deployLiquityCoreMainnet(deployerWallet, tellorMasterAddr, deploymentState, gasPrice) {
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
	const priceFeed = await this.loadOrDeploy(priceFeedFactory, 'priceFeed', deployerWallet, deploymentState, gasPrice)
	const sortedTroves = await this.loadOrDeploy(sortedTrovesFactory, 'sortedTroves', deployerWallet, deploymentState, gasPrice)
	const troveManager = await this.loadOrDeploy(troveManagerFactory, 'troveManager', deployerWallet, deploymentState, gasPrice)
	const activePool = await this.loadOrDeploy(activePoolFactory, 'activePool', deployerWallet, deploymentState, gasPrice)
	const stabilityPool = await this.loadOrDeploy(stabilityPoolFactory, 'stabilityPool', deployerWallet, deploymentState, gasPrice)
	const gasPool = await this.loadOrDeploy(gasPoolFactory, 'gasPool', deployerWallet, deploymentState, gasPrice)
	const defaultPool = await this.loadOrDeploy(defaultPoolFactory, 'defaultPool', deployerWallet, deploymentState, gasPrice)
	const collSurplusPool = await this.loadOrDeploy(collSurplusPoolFactory, 'collSurplusPool', deployerWallet, deploymentState, gasPrice)
	const borrowerOperations = await this.loadOrDeploy(borrowerOperationsFactory, 'borrowerOperations', deployerWallet, deploymentState, gasPrice)
	const hintHelpers = await this.loadOrDeploy(hintHelpersFactory, 'hintHelpers', deployerWallet, deploymentState, gasPrice)
	const tellorCaller = await this.loadOrDeploy(tellorCallerFactory, 'tellorCaller', deployerWallet, deploymentState, gasPrice, [tellorMasterAddr])

	const lusdToken = await this.loadOrDeploy(
            lusdTokenFactory,
            'lusdToken',
            deployerWallet,
            deploymentState,
						gasPrice,
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

    static async deployLQTYContractsMainnet(bountyAddress, lpRewardsAddress, multisigAddress, deployerWallet, deploymentState, gasPrice) {
        const lqtyStakingFactory = await this.getFactory("LQTYStaking", deployerWallet)
        const lockupContractFactory_Factory = await this.getFactory("LockupContractFactory", deployerWallet)
        const communityIssuanceFactory = await this.getFactory("CommunityIssuance", deployerWallet)
        const lqtyTokenFactory = await this.getFactory("LQTYToken", deployerWallet)

        const lqtyStaking = await this.loadOrDeploy(lqtyStakingFactory, 'lqtyStaking', deployerWallet, deploymentState, gasPrice)
        const lockupContractFactory = await this.loadOrDeploy(lockupContractFactory_Factory, 'lockupContractFactory', deployerWallet, deploymentState, gasPrice)
        const communityIssuance = await this.loadOrDeploy(communityIssuanceFactory, 'communityIssuance', deployerWallet, deploymentState, gasPrice)

        // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor
        const lqtyToken = await this.loadOrDeploy(
            lqtyTokenFactory,
            'lqtyToken',
            deployerWallet,
            deploymentState,
						gasPrice,
            [
                communityIssuance.address,
                lqtyStaking.address,
                lockupContractFactory.address,
                bountyAddress,
                lpRewardsAddress,
                multisigAddress
            ]
        )

        const LQTYContracts = {
            lqtyStaking,
            lockupContractFactory,
            communityIssuance,
            lqtyToken
        }
        return LQTYContracts
    }

    static async deployUnipoolMainnet(deployerWallet, deploymentState, gasPrice) {
        const unipoolFactory = await this.getFactory("Unipool", deployerWallet)
        const unipool = await this.loadOrDeploy(unipoolFactory, 'unipool', deployerWallet, deploymentState, gasPrice)

        return unipool
    }

		static async deployMultiTroveGetterMainnet(liquityCore, deployerWallet, deploymentState, gasPrice) {
			const multiTroveGetterFactory = await this.getFactory("MultiTroveGetter", deployerWallet)
			const multiTroveGetter = await this.loadOrDeploy(
				multiTroveGetterFactory, 
				'multiTroveGetter',
				deployerWallet,
				deploymentState,
				gasPrice, 
				[
					liquityCore.troveManager.address,
					liquityCore.sortedTroves.address
				]
			)
			return multiTroveGetter
		}

    // --- Connector methods ---

    static async isOwnershipRenounced(contract) {
        const owner = await contract.owner()
        return owner == ZERO_ADDRESS
    }
    // Connect contracts to their dependencies
    static async connectCoreContractsMainnet(contracts, LQTYContracts, chainlinkProxyAddress, mainnetProvider, gasPrice) {
        // Set ChainlinkAggregatorProxy and TellorCaller in the PriceFeed
        await this.isOwnershipRenounced(contracts.priceFeed) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.tellorCaller.address, {gasPrice}))

        // set TroveManager addr in SortedTroves
        await this.isOwnershipRenounced(contracts.sortedTroves) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.sortedTroves.setParams(
                maxBytes32,
                contracts.troveManager.address,
                contracts.borrowerOperations.address, 
								{gasPrice}
            ))

        // set contracts in the Trove Manager
        await this.isOwnershipRenounced(contracts.troveManager) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.troveManager.setAddresses(
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
                LQTYContracts.lqtyStaking.address,
								{gasPrice}
            ))

        // set contracts in BorrowerOperations 
        await this.isOwnershipRenounced(contracts.borrowerOperations) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.borrowerOperations.setAddresses(
                contracts.troveManager.address,
                contracts.activePool.address,
                contracts.defaultPool.address,
                contracts.stabilityPool.address,
                contracts.gasPool.address,
                contracts.collSurplusPool.address,
                contracts.priceFeed.address,
                contracts.sortedTroves.address,
                contracts.lusdToken.address,
                LQTYContracts.lqtyStaking.address,
								{gasPrice}
            ))

        // set contracts in the Pools
        await this.isOwnershipRenounced(contracts.stabilityPool) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.stabilityPool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.activePool.address,
                contracts.lusdToken.address,
                contracts.sortedTroves.address,
                contracts.priceFeed.address,
                LQTYContracts.communityIssuance.address,
								{gasPrice}
            ))

        await this.isOwnershipRenounced(contracts.activePool) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.activePool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.stabilityPool.address,
                contracts.defaultPool.address,
								{gasPrice}
            ))

        await this.isOwnershipRenounced(contracts.defaultPool) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.defaultPool.setAddresses(
                contracts.troveManager.address,
                contracts.activePool.address,
								{gasPrice}
            ))

        await this.isOwnershipRenounced(contracts.collSurplusPool) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.collSurplusPool.setAddresses(
                contracts.borrowerOperations.address,
                contracts.troveManager.address,
                contracts.activePool.address,
								{gasPrice}
            ))

        // set contracts in HintHelpers
        await this.isOwnershipRenounced(contracts.hintHelpers) ||
            await this.sendAndWaitForTransaction(mainnetProvider, contracts.hintHelpers.setAddresses(
                contracts.sortedTroves.address,
                contracts.troveManager.address,
								{gasPrice}
            ))
    }

    static async connectLQTYContractsMainnet(LQTYContracts, mainnetProvider, gasPrice) {
        let tx
        // Set LQTYToken address in LCF
        await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
            await this.sendAndWaitForTransaction(mainnetProvider, LQTYContracts.lockupContractFactory.setLQTYTokenAddress(LQTYContracts.lqtyToken.address, {gasPrice}))
    }

    static async connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts, mainnetProvider, gasPrice) {
        let tx
        await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
            await this.sendAndWaitForTransaction(mainnetProvider, LQTYContracts.lqtyStaking.setAddresses(
                LQTYContracts.lqtyToken.address,
                coreContracts.lusdToken.address,
                coreContracts.troveManager.address, 
                coreContracts.borrowerOperations.address,
                coreContracts.activePool.address,
								{gasPrice}
            ))

        await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
            await this.sendAndWaitForTransaction(mainnetProvider, LQTYContracts.communityIssuance.setAddresses(
                LQTYContracts.lqtyToken.address,
                coreContracts.stabilityPool.address,
								{gasPrice}
            ))
    }

    static async connectUnipoolMainnet(uniPool, LQTYContracts, LUSDWETHPairAddr, duration, mainnetProvider, gasPrice) {
        let tx
        await this.isOwnershipRenounced(uniPool) ||
            await this.sendAndWaitForTransaction(mainnetProvider, uniPool.setParams(LQTYContracts.lqtyToken.address, LUSDWETHPairAddr, duration, {gasPrice}))
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
