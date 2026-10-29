const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying DreamList to ${hre.network.name} from ${deployer.address}...`);

  const DreamList = await hre.ethers.getContractFactory("DreamList");
  const contract = await DreamList.deploy();
  await contract.waitForDeployment();

  console.log(`DreamList deployed to: ${await contract.getAddress()}`);
  console.log("This is one shared contract: every wallet keeps its own list inside it. There is no owner and nothing to configure.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
