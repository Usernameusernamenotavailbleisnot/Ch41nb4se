// Bridge operations between networks
const { ethers } = require('ethers');
const axios = require('axios');
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const proxyManager = require('../core/proxy');

class Bridge extends BaseOperation {
  constructor(blockchainOrPrivateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: false,
      amount: {
        min: 0.0001,
        max: 0.0004,
        decimals: 7
      },
      sepolia_to_chainbase: {
        enabled: true
      },
      chainbase_to_sepolia: {
        enabled: true
      },
      repeat_times: 1
    };
    
    // Initialize base class
    super(blockchainOrPrivateKey, configObj, 'bridge');
    
    // Set default config
    this.defaultConfig = defaultConfig;
  }
  
  async getBalances() {
    try {
      const sepoliaBalanceData = await this.blockchain.getBalance('sepolia');
      const chainbaseBalanceData = await this.blockchain.getBalance('chainbase');
      
      this.logger.info(`💰 Current Balances:`);
      this.logger.info(`  • Sepolia: ${sepoliaBalanceData.balanceInEth} ETH`);
      this.logger.info(`  • Chainbase: ${chainbaseBalanceData.balanceInEth} ETH`);
      
      return { 
        sepolia_balance: sepoliaBalanceData.balance, 
        chainbase_balance: chainbaseBalanceData.balance
      };
    } catch (error) {
      this.logger.error(`Failed to get balances: ${error.message}`);
      return { 
        sepolia_balance: '0', 
        chainbase_balance: '0'
      };
    }
  }
  
  generateRandomAmount(direction) {
    // Get direction-specific config
    const directionConfig = this.config.get ? 
      this.config.get(`operations.bridge.${direction}`, {}) : 
      (this.config.operations?.bridge?.[direction] || {});
    
    // Use direction-specific amount or fallback to general amount
    const amountConfig = directionConfig.amount || 
      (this.config.get ? 
        this.config.get('operations.bridge.amount', {
          min: 0.0001,
          max: 0.0004,
          decimals: 7
        }) : 
        (this.config.operations?.bridge?.amount || {
          min: 0.0001,
          max: 0.0004,
          decimals: 7
        }));
    
    const min = parseFloat(amountConfig.min);
    const max = parseFloat(amountConfig.max);
    const decimals = parseInt(amountConfig.decimals);
    
    // Generate random amount
    const randomValue = min + Math.random() * (max - min);
    const amount_eth = randomValue.toFixed(decimals);
    
    // Convert to Wei
    const amount_wei = ethers.parseEther(amount_eth);
    
    return { amount_eth, amount_wei };
  }
  
  async bridgeSepoliaToChainbase() {
    try {
      // Check if direction is enabled
      const directionEnabled = this.config.get ? 
        this.config.getBoolean('operations.bridge.sepolia_to_chainbase.enabled', true) :
        (this.config.operations?.bridge?.sepolia_to_chainbase?.enabled ?? true);
      
      if (!directionEnabled) {
        this.logger.warn(`Sepolia to Chainbase bridge is disabled in config`);
        return false;
      }
      
      // Generate random amount
      const { amount_eth, amount_wei } = this.generateRandomAmount('sepolia_to_chainbase');
      
      // Get initial balances
      const { sepolia_balance, chainbase_balance } = await this.getBalances();
      
      if (BigInt(sepolia_balance) < BigInt(amount_wei)) {
        this.logger.error(`Insufficient Sepolia balance to bridge ${amount_eth} ETH`);
        return false;
      }
      
      this.logger.info(`🌉 Starting bridge of ${amount_eth} ETH from Sepolia to Chainbase...`);
      
      // Add random delay
      await this.addDelay("Sepolia to Chainbase bridge operation");
      
      // Get bridge transaction details
      const bridgeDetails = await this.getBridgeTransactionDetails('sepolia_to_chainbase', amount_wei);
      
      if (!bridgeDetails || !bridgeDetails.success) {
        this.logger.error(`Failed to get bridge transaction details: ${bridgeDetails?.error || 'Unknown error'}`);
        return false;
      }
      
      // Prepare transaction
      const txObject = {
        to: bridgeDetails.to,
        value: amount_wei,
        data: bridgeDetails.data
      };

      // Send transaction
      const result = await this.blockchain.sendTransaction(txObject, "Sepolia to Chainbase bridge", "sepolia");
      
      if (!result.success) {
        this.logger.error(`Bridge transaction failed: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Bridge transaction sent: ${result.txHash}`);
      this.logger.success(`Track on Sepolia: ${constants.SEPOLIA.EXPLORER_URL}/tx/${result.txHash}`);
      
      // Wait for completion
      return await this.waitForBridgeCompletion('sepolia_to_chainbase', chainbase_balance, amount_wei);
      
    } catch (error) {
      this.logger.error(`Bridge transaction failed: ${error.message}`);
      return false;
    }
  }
  
  async bridgeChainbaseToSepolia() {
    try {
      // Check if direction is enabled
      const directionEnabled = this.config.get ? 
        this.config.getBoolean('operations.bridge.chainbase_to_sepolia.enabled', true) :
        (this.config.operations?.bridge?.chainbase_to_sepolia?.enabled ?? true);
      
      if (!directionEnabled) {
        this.logger.warn(`Chainbase to Sepolia bridge is disabled in config`);
        return false;
      }
      
      // Generate random amount
      const { amount_eth, amount_wei } = this.generateRandomAmount('chainbase_to_sepolia');
      
      // Get initial balances
      const { sepolia_balance, chainbase_balance } = await this.getBalances();
      
      if (BigInt(chainbase_balance) < BigInt(amount_wei)) {
        this.logger.error(`Insufficient Chainbase balance to bridge ${amount_eth} ETH`);
        return false;
      }
      
      this.logger.info(`🌉 Starting bridge of ${amount_eth} ETH from Chainbase to Sepolia...`);
      
      // Add random delay
      await this.addDelay("Chainbase to Sepolia bridge operation");
      
      // Get bridge transaction details
      const bridgeDetails = await this.getBridgeTransactionDetails('chainbase_to_sepolia', amount_wei);
      
      if (!bridgeDetails || !bridgeDetails.success) {
        this.logger.error(`Failed to get bridge transaction details: ${bridgeDetails?.error || 'Unknown error'}`);
        return false;
      }
      
      // Prepare transaction
      const txObject = {
        to: bridgeDetails.to,
        value: amount_wei,
        data: bridgeDetails.data
      };

      // Send transaction
      const result = await this.blockchain.sendTransaction(txObject, "Chainbase to Sepolia bridge", "chainbase");
      
      if (!result.success) {
        this.logger.error(`Bridge transaction failed: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Bridge transaction sent: ${result.txHash}`);
      this.logger.success(`Track on Chainbase: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      // For Chainbase to Sepolia, just need transaction confirmation
      this.logger.info(`Chainbase to Sepolia bridge transaction confirmed. Funds will arrive on Sepolia in 30-60 minutes.`);
      
      return true;
      
    } catch (error) {
      this.logger.error(`Bridge transaction failed: ${error.message}`);
      return false;
    }
  }
  
  async getBridgeTransactionDetails(direction, amount) {
    try {
      const isSepoliaToChainbase = direction === 'sepolia_to_chainbase';
      const bridgeConfig = isSepoliaToChainbase ? 
                        constants.BRIDGE.SEPOLIA_TO_CHAINBASE : 
                        constants.BRIDGE.CHAINBASE_TO_SEPOLIA;
      
      const fromChainId = isSepoliaToChainbase ? 
                       constants.SEPOLIA.CHAIN_ID.toString() : 
                       constants.NETWORK.CHAIN_ID.toString();
      
      const toChainId = isSepoliaToChainbase ? 
                     constants.NETWORK.CHAIN_ID.toString() : 
                     constants.SEPOLIA.CHAIN_ID.toString();
      
      // Get gas prices
      let fromGasPrice, toGasPrice;
      if (isSepoliaToChainbase) {
        fromGasPrice = await this.blockchain.getGasPrice(0, 'sepolia');
        toGasPrice = await this.blockchain.getGasPrice(0, 'chainbase');
      } else {
        fromGasPrice = await this.blockchain.getGasPrice(0, 'chainbase');
        toGasPrice = await this.blockchain.getGasPrice(0, 'sepolia');
      }
      
      // Create API request payload
      const payload = {
        host: "testnet.bridge.chainbase.com",
        amount: amount.toString(),
        fromChainId: fromChainId,
        toChainId: toChainId,
        fromTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
        toTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
        fromTokenDecimals: 18,
        toTokenDecimals: 18,
        fromGasPrice: fromGasPrice.toString(),
        toGasPrice: toGasPrice.toString(),
        graffiti: "superbridge",
        recipient: this.blockchain.address,
        sender: this.blockchain.address,
        forceViaL1: false
      };
      
      // Configure API request headers
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.5',
        'content-type': 'application/json',
        'origin': bridgeConfig.ORIGIN,
        'referer': bridgeConfig.REFERER,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
      };
      
      this.logger.info(`Calling bridge API to get transaction details...`);
      
      // Get proxy config for axios
      const axiosConfig = proxyManager.getAxiosConfig();
      
      // Make API request
      const response = await axios.post(
        bridgeConfig.API_URL, 
        payload, 
        { 
          headers,
          ...axiosConfig
        }
      );
      
      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = response.data;
      
      // Check for expected data
      if (!data.results || data.results.length === 0) {
        throw new Error('No bridge routes returned from API');
      }
      
      const routeId = isSepoliaToChainbase ? 'OptimismDeposit' : 'OptimismWithdrawal';
      const route = data.results.find(r => r.id === routeId);
      
      if (!route || !route.result || !route.result.initiatingTransaction) {
        throw new Error(`Could not find ${routeId} route in API response`);
      }
      
      const tx = route.result.initiatingTransaction;
      
      this.logger.info(`Successfully got bridge transaction details`);
      
      return {
        success: true,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chainId: tx.chainId
      };
      
    } catch (error) {
      this.logger.error(`Error getting bridge transaction details: ${error.message}`);
      
      // Try changing proxy for network errors
      if (proxyManager.isEnabled() && 
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Proxy error detected, trying to change proxy...');
        proxyManager.selectNextProxy();
        
        // Retry once with new proxy
        try {
          this.logger.info('Retrying API call with new proxy...');
          return await this.getBridgeTransactionDetails(direction, amount);
        } catch (retryError) {
          this.logger.error(`Retry failed: ${retryError.message}`);
        }
      }
      
      // Fallback to hardcoded transaction details
      if (direction === 'sepolia_to_chainbase') {
        const fallbackTx = {
          success: true,
          to: constants.BRIDGE.SEPOLIA_TO_CHAINBASE.INBOX_ADDRESS,
          data: constants.BRIDGE.SEPOLIA_TO_CHAINBASE.DEPOSIT_FUNCTION,
          value: amount.toString(),
          chainId: constants.SEPOLIA.CHAIN_ID.toString()
        };
        this.logger.warn(`Falling back to hardcoded transaction details`);
        return fallbackTx;
      } else {
        const fallbackTx = {
          success: true,
          to: constants.BRIDGE.CHAINBASE_TO_SEPOLIA.OUTBOX_ADDRESS,
          data: constants.BRIDGE.CHAINBASE_TO_SEPOLIA.WITHDRAWAL_FUNCTION,
          value: amount.toString(),
          chainId: constants.NETWORK.CHAIN_ID.toString()
        };
        this.logger.warn(`Falling back to hardcoded transaction details`);
        return fallbackTx;
      }
    }
  }
  
  async waitForBridgeCompletion(direction, initialBalance, amountBridgedWei) {
    // Only monitor Sepolia to Chainbase
    if (direction !== 'sepolia_to_chainbase') {
      this.logger.info(`No need to monitor ${direction} bridge completion, transaction confirmed is sufficient.`);
      return true;
    }
    
    this.logger.info(`🔄 Monitoring Sepolia to Chainbase bridge progress...`);
    
    const checkInterval = 30; // 30 seconds
    const maxChecks = 20;     // 10 minutes max
    let checks = 0;
    
    // Convert to BigInt for comparison
    const initialBalanceBigInt = BigInt(initialBalance);
    
    while (checks < maxChecks) {
      // Add delay between checks
      await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
      
      try {
        const currentBalanceData = await this.blockchain.getBalance('chainbase');
        const currentBalance = BigInt(currentBalanceData.balance);
        
        if (currentBalance > initialBalanceBigInt) {
          const balanceIncrease = currentBalance - initialBalanceBigInt;
          const increaseEth = ethers.formatEther(balanceIncrease);
          
          this.logger.success(`Bridge completed! Received ${Number(increaseEth).toFixed(4)} ETH on Chainbase`);
          return true;
        }
        
        checks++;
        this.logger.info(`⏳ Waiting for bridge completion... (${checks}/${maxChecks})`);
        
      } catch (error) {
        this.logger.warn(`Error checking balance: ${error.message}`);
        checks++;
      }
    }
    
    this.logger.warn(`Bridge monitoring timed out after ${maxChecks * checkInterval} seconds`);
    this.logger.warn(`Bridge transaction was sent successfully, but completion wasn't detected within the timeout`);
    
    return true; // Return true since transaction was sent
  }

  async executeOperations() {
    try {
      // Reset nonce tracking
      this.blockchain.resetNonce('sepolia');
      this.blockchain.resetNonce('chainbase');
      
      // Get bridge direction preferences
      const bridgeSepoliaToChainbase = this.config.get ? 
        this.config.getBoolean('operations.bridge.sepolia_to_chainbase.enabled', true) :
        (this.config.operations?.bridge?.sepolia_to_chainbase?.enabled ?? true);
      
      const bridgeChainbaseToSepolia = this.config.get ? 
        this.config.getBoolean('operations.bridge.chainbase_to_sepolia.enabled', true) :
        (this.config.operations?.bridge?.chainbase_to_sepolia?.enabled ?? true);
      
      // Get repeat count
      const repeatTimes = this.config.get ? 
        this.config.getRepeatTimes('bridge', 1) :
        (this.config.operations?.bridge?.repeat_times || 1);
      
      // Determine directions to run
      const directions = [];
      if (bridgeSepoliaToChainbase) directions.push('sepolia_to_chainbase');
      if (bridgeChainbaseToSepolia) directions.push('chainbase_to_sepolia');
      
      if (directions.length === 0) {
        this.logger.warn(`No bridge directions enabled in config`);
        return true;
      }
      
      this.logger.info(`🔄 Will perform ${repeatTimes} bridge operations in directions: ${directions.join(', ')}...`);
      
      let successCount = 0;
      for (let i = 0; i < repeatTimes; i++) {
        for (const direction of directions) {
          this.logger.info(`📍 ${direction} bridge operation ${i+1}/${repeatTimes}`);
          
          let success;
          if (direction === 'sepolia_to_chainbase') {
            success = await this.bridgeSepoliaToChainbase();
          } else {
            success = await this.bridgeChainbaseToSepolia();
          }
          
          if (success) {
            successCount++;
          }
          
          // Add delay between operations if not the last one
          if (i < repeatTimes - 1 || direction !== directions[directions.length - 1]) {
            this.logger.info(`⏳ Waiting before next bridge operation...`);
            await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay
          }
        }
      }
      
      const totalOperations = repeatTimes * directions.length;
      this.logger.success(`Bridge operations completed: ${successCount}/${totalOperations} successful`);
      return successCount > 0;
      
    } catch (error) {
      this.logger.error(`Error in bridge operations: ${error.message}`);
      return false;
    }
  }
}

module.exports = Bridge;