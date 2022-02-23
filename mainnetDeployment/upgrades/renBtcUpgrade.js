
async function main() {
  const ActivePoolFactory = await ethers.getContractFactory("ActivePool", this.deployerWallet)
  const DefaultPoolFactory = await ethers.getContractFactory("DefaultPool", this.deployerWallet)
  const StabilityPoolFactory = await ethers.getContractFactory("StabilityPool", this.deployerWallet)
  const VSTAStakingFactory = await ethers.getContractFactory("VSTAStaking", this.deployerWallet)
  const BorrowerOperationsFactory = await ethers.getContractFactory("BorrowerOperations", this.deployerWallet)
  const CollSurplusPoolFactory = await ethers.getContractFactory("CollSurplusPool", this.deployerWallet)


  console.log("Active Pool", (await ActivePoolFactory.deploy()).address);
  console.log("Default Pool", (await DefaultPoolFactory.deploy()).address);
  console.log("Stability Pool", (await StabilityPoolFactory.deploy()).address);
  console.log("VSTA Staking", (await VSTAStakingFactory.deploy()).address);
  console.log("Borrower", (await BorrowerOperationsFactory.deploy()).address);
  console.log("CollSurplus", (await CollSurplusPoolFactory.deploy()).address);
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
