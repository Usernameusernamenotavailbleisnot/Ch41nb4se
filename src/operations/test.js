// Contract testing operations
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const ContractManager = require('../core/contract');

class Test extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      test_sequences: ["parameter_variation", "stress_test", "boundary_test"],
      iterations: {
        min: 3,
        max: 10
      }
    };
    
    // Initialize base class
    super(privateKey, configObj, 'contract_testing');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Initialize contract manager
    this.contractManager = new ContractManager(this.blockchain, configObj);
  }
  
  generateTestValues() {
    // Generate test values including edge cases
    return [
      0,                              // Zero
      1,                              // One
      10,                             // Small number
      100,                            // Medium number
      1000,                           // Large number
      10000,                          // Very large number
      2**32 - 1,                      // 32-bit max
      2**48 - 1,                      // 48-bit max
      Math.floor(Number.MAX_SAFE_INTEGER / 2), // Half JS max
      Number.MAX_SAFE_INTEGER,        // JS max
      // Random values
      ...Array(5).fill(0).map(() => Math.floor(Math.random() * 1000000))
    ];
  }
  
  async executeOperations() {
    try {
      // Compile and deploy test contract
      this.logger.info(`Compiling parameter tester contract...`);
      const compiledContract = await this.contractManager.compileContract(
        'ParameterTesterContract', 
        constants.CONTRACT_TESTING.TEST_CONTRACT_SOURCE, 
        'ParameterTesterContract.sol'
      );
      
      // Add delay before deployment
      await this.addDelay("test contract deployment");
      
      // Deploy contract
      this.logger.info(`Deploying parameter tester contract...`);
      const deployedContract = await this.contractManager.deployContract(
        compiledContract, 
        [], 
        "parameter tester contract"
      );
      
      // Get test sequences
      const testSequences = this.config.get ? 
        this.config.getArray('operations.contract_testing.test_sequences', 
          ["parameter_variation", "stress_test", "boundary_test"]) :
        ["parameter_variation", "stress_test", "boundary_test"];
      
      this.logger.info(`Will run the following test sequences: ${testSequences.join(', ')}`);
      
      const results = {
        parameter_variation: false,
        stress_test: false,
        boundary_test: false
      };
      
      // Run selected test sequences
      for (const sequence of testSequences) {
        switch (sequence) {
          case "parameter_variation":
            results.parameter_variation = await this.performParameterVariationTests(
              deployedContract.contractAddress, 
              deployedContract.abi
            );
            break;
          case "stress_test":
            results.stress_test = await this.performStressTests(
              deployedContract.contractAddress, 
              deployedContract.abi
            );
            break;
          case "boundary_test":
            results.boundary_test = await this.performBoundaryTests(
              deployedContract.contractAddress, 
              deployedContract.abi
            );
            break;
        }
      }
      
      // Summarize results
      this.logger.success(`Contract testing operations completed!`);
      this.logger.success(`Contract address: ${deployedContract.contractAddress}`);
      this.logger.success(`Test results:`);
      
      for (const [sequence, result] of Object.entries(results)) {
        if (testSequences.includes(sequence)) {
          this.logger.success(`- ${sequence}: ${result ? 'Successful' : 'Failed'}`);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error in contract testing operations: ${error.message}`);
      return false;
    }
  }
  
  async performParameterVariationTests(contractAddress, abi) {
    try {
      this.logger.info(`Starting parameter variation tests...`);
      
      // Generate test values
      const testValues = this.generateTestValues();
      
      // Get number of iterations
      const iterations = this.config.get ? 
        this.config.getRandomInRange('contract_testing', 'iterations', 3, 10) :
        Math.floor(Math.random() * 8) + 3; // 3-10
      
      this.logger.info(`Will perform ${iterations} iterations of parameter variation tests...`);
      
      let successCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        // Select random test value
        const value = testValues[Math.floor(Math.random() * testValues.length)];
        
        // Add delay before test
        await this.addDelay(`parameter test ${i+1}/${iterations}`);
        
        this.logger.info(`Testing parameter value: ${value} (${i+1}/${iterations})...`);
        
        // Call setValue function
        const result = await this.contractManager.callContractMethod(
          contractAddress,
          abi,
          'setValue',
          [value]
        );
        
        if (result.success) {
          this.logger.success(`Parameter test successful: setValue(${value})`);
          successCount++;
          
          // Verify value
          const verifyResult = await this.contractManager.callViewMethod(
            contractAddress,
            abi,
            'getValue',
            []
          );
          
          if (verifyResult.success) {
            this.logger.info(`Verified value: ${verifyResult.result}`);
          }
        } else {
          this.logger.error(`Parameter test failed for value ${value}: ${result.error}`);
        }
      }
      
      this.logger.success(`Parameter variation tests completed: ${successCount}/${iterations} successful`);
      return successCount > 0;
    } catch (error) {
      this.logger.error(`Error in parameter variation tests: ${error.message}`);
      return false;
    }
  }
  
  async performStressTests(contractAddress, abi) {
    try {
      this.logger.info(`Starting stress tests...`);
      
      // Define operations
      const operations = [
        { name: "addValue", argsGenerator: () => [Math.floor(Math.random() * 100) + 1] },
        { name: "subtractValue", argsGenerator: () => [Math.floor(Math.random() * 100) + 1] }
      ];
      
      // Get iterations
      const iterations = this.config.get ? 
        this.config.getRandomInRange('contract_testing', 'iterations', 3, 10) :
        Math.floor(Math.random() * 8) + 3; // 3-10
      
      this.logger.info(`Will perform ${iterations} iterations of stress tests...`);
      
      let successCount = 0;
      
      // Set base value
      try {
        const baseValue = 10000;
        
        const setValueResult = await this.contractManager.callContractMethod(
          contractAddress,
          abi,
          'setValue',
          [baseValue]
        );
        
        if (setValueResult.success) {
          this.logger.success(`Base value set to ${baseValue}`);
        } else {
          this.logger.error(`Failed to set base value for stress tests: ${setValueResult.error}`);
          return false;
        }
      } catch (error) {
        this.logger.error(`Failed to set base value for stress tests: ${error.message}`);
        return false;
      }
      
      // Run stress tests
      for (let i = 0; i < iterations; i++) {
        // Select random operation
        const operation = operations[Math.floor(Math.random() * operations.length)];
        
        // Generate arguments
        const args = operation.argsGenerator();
        
        // Add delay before test
        await this.addDelay(`stress test ${i+1}/${iterations}`);
        
        this.logger.info(`Stress test: ${operation.name}(${args.join(', ')}) (${i+1}/${iterations})...`);
        
        // Call the operation
        const result = await this.contractManager.callContractMethod(
          contractAddress,
          abi,
          operation.name,
          args
        );
        
        if (result.success) {
          this.logger.success(`Stress test successful: ${operation.name}(${args.join(', ')})`);
          successCount++;
          
          // Check current value
          const currentValueResult = await this.contractManager.callViewMethod(
            contractAddress,
            abi,
            'getValue',
            []
          );
          
          if (currentValueResult.success) {
            this.logger.info(`Current value after operation: ${currentValueResult.result}`);
          }
        } else {
          this.logger.error(`Stress test failed for ${operation.name}(${args.join(', ')}): ${result.error}`);
        }
      }
      
      this.logger.success(`Stress tests completed: ${successCount}/${iterations} successful`);
      return successCount > 0;
    } catch (error) {
      this.logger.error(`Error in stress tests: ${error.message}`);
      return false;
    }
  }
  
  async performBoundaryTests(contractAddress, abi) {
    try {
      this.logger.info(`Starting boundary tests...`);
      
      // Define boundary values
      const boundaryValues = [
        0,                // Zero
        1,                // One
        2**16 - 1,        // 16-bit max (65535)
        2**16,            // 16-bit max + 1
        2**32 - 1,        // 32-bit max
        2**32,            // 32-bit max + 1
        2**48 - 1,        // 48-bit max
        2**48,            // 48-bit max + 1
        Number.MAX_SAFE_INTEGER // JS max
      ];
      
      this.logger.info(`Will test ${boundaryValues.length} boundary values...`);
      
      let successCount = 0;
      
      for (let i = 0; i < boundaryValues.length; i++) {
        const value = boundaryValues[i];
        
        // Add delay before test
        await this.addDelay(`boundary test ${i+1}/${boundaryValues.length}`);
        
        this.logger.info(`Boundary test: setValue(${value}) (${i+1}/${boundaryValues.length})...`);
        
        // Call setValue
        const result = await this.contractManager.callContractMethod(
          contractAddress,
          abi,
          'setValue',
          [value]
        );
        
        if (result.success) {
          this.logger.success(`Boundary test successful: setValue(${value})`);
          successCount++;
          
          // Verify value
          const verifyResult = await this.contractManager.callViewMethod(
            contractAddress,
            abi,
            'getValue',
            []
          );
          
          if (verifyResult.success) {
            this.logger.info(`Verified value: ${verifyResult.result}`);
          }
        } else {
          this.logger.error(`Boundary test failed for value ${value}: ${result.error}`);
        }
      }
      
      this.logger.success(`Boundary tests completed: ${successCount}/${boundaryValues.length} successful`);
      return successCount > 0;
    } catch (error) {
      this.logger.error(`Error in boundary tests: ${error.message}`);
      return false;
    }
  }
}

module.exports = Test;