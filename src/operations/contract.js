// Contract deployment and interaction operations
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const ContractManager = require('../core/contract');

class Contract extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      interactions: {
        enabled: true,
        count: {
          min: 3,
          max: 8
        },
        types: ["setValue", "increment", "decrement", "reset", "contribute"]
      }
    };
    
    // Initialize base class
    super(privateKey, configObj, 'contract_deploy');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Initialize contract manager
    this.contractManager = new ContractManager(this.blockchain, configObj);
  }
  
  async executeOperations() {
    try {
      // Step 1: Compile the contract
      this.logger.info(`Compiling smart contract...`);
      const compiledContract = await this.contractManager.compileContract(
        'InteractiveContract', 
        constants.CONTRACT.SAMPLE_CONTRACT_SOURCE,
        'Contract.sol'
      );
      
      // Add delay before deployment
      await this.addDelay("contract deployment");
      
      // Step 2: Deploy the contract
      this.logger.info(`Deploying smart contract...`);
      const deployedContract = await this.contractManager.deployContract(
        compiledContract, 
        [], 
        "InteractiveContract"
      );
      
      this.logger.success(`Contract deployed at: ${deployedContract.contractAddress}`);
      
      // Skip interactions if disabled
      const interactionsEnabled = this.config.get ? 
        this.config.getBoolean('operations.contract_deploy.interactions.enabled', true) :
        (this.config.operations?.contract_deploy?.interactions?.enabled ?? true);
      
      if (!interactionsEnabled) {
        this.logger.warn(`Contract interactions disabled in config`);
        return true;
      }
      
      // Get interaction count
      const interactionCount = this.config.get ? 
        this.config.getRandomInRange('contract_deploy', 'interactions.count', 3, 8) :
        Math.floor(Math.random() * 6) + 3; // 3-8
      
      // Get interaction types
      const interactionTypes = this.config.get ? 
        this.config.getArray('operations.contract_deploy.interactions.types', 
          ["setValue", "increment", "decrement", "reset", "contribute"]) :
        ["setValue", "increment", "decrement", "reset", "contribute"];
      
      this.logger.info(`Will perform ${interactionCount} interactions with contract...`);
      
      let successCount = 0;
      for (let i = 0; i < interactionCount; i++) {
        const success = await this.performRandomInteraction(
          deployedContract, 
          interactionTypes, 
          i + 1, 
          interactionCount
        );
        if (success) successCount++;
      }
      
      this.logger.success(`Contract operations completed: ${successCount}/${interactionCount} successful interactions`);
      return true;
      
    } catch (error) {
      this.logger.error(`Error in contract operations: ${error.message}`);
      return false;
    }
  }
  
  async performRandomInteraction(deployedContract, interactionTypes, currentNum, totalNum) {
    try {
      // Select random interaction type
      const interactionType = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
      
      this.logger.info(`Interaction ${currentNum}/${totalNum}: ${interactionType}...`);
      
      let methodArgs = [];
      let value = '0';
      
      // Prepare args based on interaction type
      switch (interactionType) {
        case 'setValue':
          methodArgs = [Math.floor(Math.random() * 1000)]; // Random 0-999
          break;
        case 'contribute':
          // Use ethers.parseEther to convert ETH to wei
          value = ethers.parseEther("0.00001"); // Small contribution
          break;
      }
      
      //await this.addDelay(`contract interaction (${interactionType})`);
      
      const result = await this.contractManager.callContractMethod(
        deployedContract.contractAddress,
        deployedContract.abi,
        interactionType,
        methodArgs,
        value
      );
      
      if (result.success) {
        this.logger.success(`${interactionType} successful`);
        return true;
      } else {
        this.logger.error(`${interactionType} failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error in interaction: ${error.message}`);
      return false;
    }
  }
}

module.exports = Contract;