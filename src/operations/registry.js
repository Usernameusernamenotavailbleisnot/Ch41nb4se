// Registry for all blockchain operations
const config = require('../core/config');
const logger = require('../utils/logger');
const Blockchain = require('../core/blockchain');
const proxyManager = require('../core/proxy');

class OperationRegistry {
  constructor(privateKey, configObj = {}, walletNum = null) {
    this.privateKey = privateKey;
    this.config = configObj;
    this.walletNum = walletNum;
    this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Create a blockchain instance for this wallet
    this.blockchain = new Blockchain(privateKey, configObj, walletNum);
    
    // Load operations
    this._loadOperations();
  }
  
  _loadOperations() {
    // Import operation modules
    const Transfer = require('./transfer');
    const Contract = require('./contract');
    const ERC20 = require('./erc20');
    const NFT = require('./nft');
    const TestContract = require('./test');
    const Batch = require('./batch');
    const Bridge = require('./bridge');
    
    // Initialize with shared blockchain instance
    this.operations = [
      { 
        name: "bridge", 
        instance: new Bridge(this.blockchain, this.config) 
      },
      { 
        name: "transfer", 
        instance: new Transfer(this.blockchain, this.config) 
      },
      { 
        name: "contract_deploy", 
        instance: new Contract(this.blockchain, this.config) 
      },
      { 
        name: "contract_testing", 
        instance: new TestContract(this.blockchain, this.config) 
      },
      { 
        name: "erc20", 
        instance: new ERC20(this.blockchain, this.config) 
      },
      { 
        name: "nft", 
        instance: new NFT(this.blockchain, this.config) 
      },
      { 
        name: "batch_operations", 
        instance: new Batch(this.blockchain, this.config) 
      }
    ];
    
    // Set wallet number for all operations
    if (this.walletNum !== null) {
      this.operations.forEach(op => op.instance.setWalletNum(this.walletNum));
    }
  }
  
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
    this.blockchain.setWalletNum(num);
    this.operations.forEach(op => op.instance.setWalletNum(num));
  }
  
  getOperation(name) {
    const operation = this.operations.find(op => op.name === name);
    return operation ? operation.instance : null;
  }
  
  rotateProxyIfNeeded() {
    // Skip if proxy not enabled
    if (!proxyManager.isEnabled()) {
      return;
    }
    
    // Skip if rotation not enabled
    if (!this.config.get('proxy.rotation.enabled') || !this.config.get('proxy.rotation.per_operation')) {
      return;
    }
    
    this.logger.info('Rotating proxy for next operation...');
    this.blockchain.changeProxy();
  }
  
  getRandomizedOperations() {
    // Get randomization config
    const randomization = this.config.get ? 
      this.config.get('randomization', {}) : 
      (this.config.randomization || {});
    
    // Get operations to run
    const operationsToRun = randomization.operations_to_run || 
      this.operations.map(op => op.name);
    
    // Filter enabled operations
    const filteredOperations = this.operations.filter(op => 
      operationsToRun.includes(op.name) && op.instance.isEnabled());
    
    // Split into fixed and randomizable operations
    const excludedOps = randomization.excluded_operations || [];
    const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
    const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
    
    // Randomize if enabled
    if (randomization.enable && randomizableOps.length > 1) {
      this._shuffleArray(randomizableOps);
    }
    
    // Return operations in order
    return [...fixedOps, ...randomizableOps];
  }
  
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  async executeAll() {
    const operations = this.getRandomizedOperations();
    
    // Log operations sequence
    this.logger.info(`Operations sequence: ${operations.map(op => op.name).join(' -> ')}`);
    
    let success = true;
    
    // Execute operations in sequence
    for (const operation of operations) {
      try {
        logger.setWalletNum(this.walletNum);
        
        // Rotate proxy if configured
        this.rotateProxyIfNeeded();
        
        const result = await operation.instance.execute();
        if (!result) success = false;
      } catch (error) {
        this.logger.error(`Error in ${operation.name} operation: ${error.message}`);
        success = false;
      }
    }
    
    return success;
  }
}

module.exports = OperationRegistry;