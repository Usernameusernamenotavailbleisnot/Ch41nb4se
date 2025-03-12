// Batch operations
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const ContractManager = require('../core/contract');

class Batch extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      operations_per_batch: {
        min: 2,
        max: 5
      }
    };
    
    // Initialize base class
    super(privateKey, configObj, 'batch_operations');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Initialize contract manager
    this.contractManager = new ContractManager(this.blockchain, configObj);
  }
  
  getBatchProcessorSource() {
    return constants.BATCH.PROCESSOR_CONTRACT;
  }
  
  generateBatchOperations() {
    // Available operations
    const operations = [
      "setValue",
      "incrementValue",
      "decrementValue",
      "squareValue",
      "resetValue",
      "multiplyValue"
    ];
    
    // Determine batch size
    const numOperations = this.config.get ? 
      this.config.getRandomInRange('batch_operations', 'operations_per_batch', 2, 5) :
      Math.floor(Math.random() * 4) + 2; // 2-5
    
    this.logger.info(`Generating batch with ${numOperations} operations...`);
    
    // Generate operations and parameters
    const batchOperations = [];
    const parameters = [];
    
    for (let i = 0; i < numOperations; i++) {
      // Select random operation
      const operation = operations[Math.floor(Math.random() * operations.length)];
      batchOperations.push(operation);
      
      // Generate appropriate parameter based on operation
      let parameter = 0;
      if (operation === "setValue") {
        parameter = Math.floor(Math.random() * 100) + 1; // 1-100
      } else if (operation === "multiplyValue") {
        parameter = Math.floor(Math.random() * 5) + 2; // 2-6
      } else {
        parameter = 0; // Other operations don't use parameters
      }
      parameters.push(parameter);
    }
    
    return { batchOperations, parameters };
  }
  
  async executeOperations() {
    try {
      // Compile and deploy batch processor contracta
      const compiledContract = await this.contractManager.compileContract(
        'BatchProcessor', 
        this.getBatchProcessorSource(), 
        'BatchProcessor.sol'
      );
      
      // Deploy batch processor contract
      const deployedContract = await this.contractManager.deployContract(
        compiledContract, 
        [], 
        "batch processor"
      );
      
      // Test individual operations for verification
      //this.logger.info(`Testing individual operations...`);
      await this.testIndividualOperations(deployedContract.contractAddress, deployedContract.abi);
      
      // Execute multiple batches
      this.logger.info(`Executing multiple batches...`);
      const batchResults = await this.executeMultipleBatches(deployedContract.contractAddress, deployedContract.abi);
      
      this.logger.success(`Batch operation operations completed successfully!`);
      this.logger.success(`Batch processor: ${deployedContract.contractAddress}`);
      this.logger.success(`View contract: ${constants.NETWORK.EXPLORER_URL}/address/${deployedContract.contractAddress}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in batch operation operations: ${error.message}`);
      return false;
    }
  }
  
  async testIndividualOperations(contractAddress, abi) {
    try {
      this.logger.info(`Testing individual operations...`);
      
      // Test setValue operation
      const testValue = Math.floor(Math.random() * 100) + 1;
      
      // Add delay before operation
      //await this.addDelay("individual operation test");
      
      // Call setValue function
      const result = await this.contractManager.callContractMethod(
        contractAddress,
        abi,
        'setValue',
        [testValue]
      );
      
      if (result.success) {
        this.logger.success(`setValue operation successful`);
        
        // Verify status
        const statusResult = await this.contractManager.callViewMethod(
          contractAddress,
          abi,
          'getStatus',
          []
        );
        
        if (statusResult.success) {
          this.logger.info(`Current status - Operation count: ${statusResult.result[0]}, Last value: ${statusResult.result[1]}`);
        }
        
        return {
          txHash: result.txHash,
          operationCount: statusResult.success ? statusResult.result[0] : '?',
          lastValue: statusResult.success ? statusResult.result[1] : '?',
          success: true
        };
      } else {
        this.logger.error(`Error testing individual operations: ${result.error}`);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      this.logger.error(`Error testing individual operations: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async executeBatchOperations(contractAddress, abi) {
    try {
      // Generate batch operations
      const { batchOperations, parameters } = this.generateBatchOperations();
      
      this.logger.info(`Executing batch operations: ${batchOperations.join(', ')}...`);
      
      // Add delay before batch execution
      //await this.addDelay("batch execution");
      
      // Call executeBatch function
      const result = await this.contractManager.callContractMethod(
        contractAddress,
        abi,
        'executeBatch',
        [batchOperations, parameters]
      );
      
      if (result.success) {
        this.logger.success(`Batch execution successful`);
        
        // Verify status after batch
        const statusResult = await this.contractManager.callViewMethod(
          contractAddress,
          abi,
          'getStatus',
          []
        );
        
        if (statusResult.success) {
          this.logger.info(`Status after batch execution - Operation count: ${statusResult.result[0]}, Last value: ${statusResult.result[1]}`);
        }
        
        return {
          txHash: result.txHash,
          operations: batchOperations,
          parameters: parameters,
          operationCount: statusResult.success ? statusResult.result[0] : '?',
          lastValue: statusResult.success ? statusResult.result[1] : '?',
          success: true
        };
      } else {
        this.logger.error(`Error executing batch operations: ${result.error}`);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      this.logger.error(`Error executing batch operations: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async executeMultipleBatches(contractAddress, abi) {
    try {
      // Number of batches to execute
      const numBatches = Math.floor(Math.random() * 2) + 1; // 1-2 batches
      
      this.logger.info(`Will execute ${numBatches} batch operations...`);
      
      const results = [];
      
      for (let i = 0; i < numBatches; i++) {
        this.logger.info(`Executing batch ${i + 1}/${numBatches}...`);
        
        // Execute batch
        const result = await this.executeBatchOperations(contractAddress, abi);
        results.push(result);
        
        // Add delay between batches if not the last one
        if (i < numBatches - 1) {
          await this.addDelay(`next batch (${i + 2}/${numBatches})`);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error executing multiple batches: ${error.message}`);
      return [];
    }
  }
}

module.exports = Batch;