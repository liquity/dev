const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class MainnetDeploymentHelper {

	// --- Deployer methods ---

	static async getFactory(name, wallet) {
		const factory = await ethers.getContractFactory(name, wallet)
		return factory
	}

	static async deployLiquityCoreMainnet(deployerWallet, tellorMasterAddr) {
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
		const priceFeed = await priceFeedFactory.deploy()
		const sortedTroves = await sortedTrovesFactory.deploy()
		const troveManager = await troveManagerFactory.deploy()
		const activePool = await activePoolFactory.deploy()
		const stabilityPool = await stabilityPoolFactory.deploy()
		const gasPool = await gasPoolFactory.deploy()
		const defaultPool = await defaultPoolFactory.deploy()
		const collSurplusPool = await collSurplusPoolFactory.deploy()
		const borrowerOperations = await borrowerOperationsFactory.deploy()
		const hintHelpers = await hintHelpersFactory.deploy()
		const tellorCaller = await tellorCallerFactory.deploy(tellorMasterAddr)

		const lusdToken = await lusdTokenFactory.deploy(
			troveManager.address,
			stabilityPool.address,
			borrowerOperations.address
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

	static async deployLQTYContractsMainnet(bountyAddress, lpRewardsAddress, deployerWallet) {
    const lqtyStakingFactory = await this.getFactory("LQTYStaking", deployerWallet)
    const lockupContractFactory_Factory = await this.getFactory("LockupContractFactory", deployerWallet)
    const communityIssuanceFactory = await this.getFactory("CommunityIssuance", deployerWallet)
    const lqtyTokenFactory = await this.getFactory("LQTYToken", deployerWallet)

    const lqtyStaking = await lqtyStakingFactory.deploy()
    const lockupContractFactory = await lockupContractFactory_Factory.deploy()
    const communityIssuance = await communityIssuanceFactory.deploy()
   
    // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor 
    const lqtyToken = await lqtyTokenFactory.deploy(
      communityIssuance.address, 
      lqtyStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress
    )
    
    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      lqtyToken
    }
    return LQTYContracts
  }

	static async deployUnipoolMainnet(contracts, deployerWallet) {
    const unipoolFactory = await this.getFactory("Unipool", deployerWallet)
    const unipool = await unipoolFactory.deploy()

    return unipool
  }

	// --- Connector methods ---

	// Connect contracts to their dependencies
  static async connectCoreContractsMainnet(contracts, LQTYContracts, chainlinkProxyAddress) {
		// Set ChainlinkAggregatorProxy and TellorCaller in the PriceFeed
		await contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.tellorCaller.address)

		// set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contracts in the Trove Manager
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
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.lusdToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeed.address,
      LQTYContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
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
    await LQTYContracts.lqtyStaking.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.lusdToken.address,
      coreContracts.troveManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
  
    await LQTYContracts.communityIssuance.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.stabilityPool.address
    )
  }

	static async connectUnipoolMainnet(uniPool, LQTYContracts, LUSDWETHPairAddr, duration) {
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
