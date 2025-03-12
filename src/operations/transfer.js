// Token transfer operations
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const BaseOperation = require('./base');

class Transfer extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      use_percentage: true,
      percentage: 90,
      fixed_amount: {
        min: 0.0001,
        max: 0.001,
        decimals: 5
      },
      count: {
        min: 1,
        max: 3
      },
      repeat_times: 1
    };
    
    // Initialize base class
    super(privateKey, configObj, 'transfer');
    
    // Set default config
    this.defaultConfig = defaultConfig;
  }
  
  generateRandomAmount() {
    // Get amount configuration
    const fixedAmount = this.config.get ? 
      this.config.get('operations.transfer.fixed_amount', this.defaultConfig.fixed_amount) : 
      (this.config.operations?.transfer?.fixed_amount || this.defaultConfig.fixed_amount);
    
    const min = parseFloat(fixedAmount.min);
    const max = parseFloat(fixedAmount.max);
    const decimals = parseInt(fixedAmount.decimals);
    
    // Generate random amount with decimal precision
    const randomValue = min + Math.random() * (max - min);
    const amount_eth = randomValue.toFixed(decimals);
    
    // Convert to Wei
    const amount_wei = ethers.parseEther(amount_eth);
    
    return { amount_eth, amount_wei };
  }
  
  async estimateGasCost(amount) {
    const txTemplate = {
      to: this.blockchain.address,
      value: amount
    };
    
    const gasLimit = await this.blockchain.estimateGas(txTemplate);
    const gasPrice = await this.blockchain.getGasPrice();
    
    return gasLimit * gasPrice;
  }
  
  async executeTransfer(transferNum, totalTransfers) {
    try {
      // Get wallet balance
      const { balance, balanceInEth, currency } = await this.blockchain.getBalance();
      
      if (balance === '0') {
        this.logger.warn(`No balance to transfer`);
        return true;
      }

      // Add random delay before transfer
      await this.addDelay(`transfer #${transferNum}/${totalTransfers}`);

      // Determine if using percentage or fixed amount
      const usePercentage = this.config.get ? 
        this.config.get('operations.transfer.use_percentage', true) : 
        (this.config.operations?.transfer?.use_percentage ?? true);
      
      // Estimate gas cost for a transfer
      const gasPrice = await this.blockchain.getGasPrice();
      const estimatedGasCost = BigInt(21000) * gasPrice * BigInt(2); // Double for safety
      
      let transferAmount;
      let displayAmount;
      
      if (!usePercentage) {
        // Get fixed amount
        const { amount_eth, amount_wei } = this.generateRandomAmount();
        transferAmount = amount_wei;
        displayAmount = amount_eth;
        
        this.logger.info(`Using fixed amount: ${displayAmount} ETH`);
      } else {
        // Use percentage of balance
        const percentage = this.config.get ? 
          this.config.get('operations.transfer.percentage', 90) : 
          (this.config.operations?.transfer?.percentage || 90);
        
        // Apply percentage to safe balance
        const safeBalance = balance - estimatedGasCost;
        if (safeBalance <= 0) {
          this.logger.warn(`Insufficient balance to perform transfer`);
          return true;
        }
        
        transferAmount = (BigInt(Math.floor(Number(safeBalance) * percentage / 100))).toString();
        displayAmount = ethers.formatEther(transferAmount);
        
        this.logger.info(`Using percentage-based amount: ${percentage}% of balance (${displayAmount} ETH)`);
      }
      
      // Verify we have enough funds
      const totalNeeded = BigInt(transferAmount) + estimatedGasCost;
      
      if (BigInt(balance) < totalNeeded) {
        this.logger.warn(`Insufficient balance for full transfer + gas, adjusting amount`);
        
        if (BigInt(balance) <= estimatedGasCost) {
          this.logger.warn(`Insufficient balance to even cover gas costs`);
          return true;
        }
        
        // Reduce amount
        transferAmount = (BigInt(balance) - estimatedGasCost).toString();
        displayAmount = ethers.formatEther(transferAmount);
      }
      
      // Create and send transaction
      const txObject = {
        to: this.blockchain.address,
        value: transferAmount
      };

      this.logger.info(`Sending transfer #${transferNum}/${totalTransfers} of ${displayAmount} ETH to self`);
      
      const result = await this.blockchain.sendTransaction(txObject, `self-transfer #${transferNum}`);
      
      if (result.success) {
        this.logger.success(`Transfer #${transferNum}/${totalTransfers} successful`);
        this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
        return true;
      } else {
        this.logger.error(`Transfer #${transferNum}/${totalTransfers} failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error in transfer #${transferNum}/${totalTransfers}: ${error.message}`);
      return false;
    }
  }

  async executeOperations() {
    // Get transfer count from config
    const count = this.config.get ? 
      this.config.getRandomInRange('transfer', 'count', 1, 3) : 
      Math.floor(Math.random() * 3) + 1;
    
    // Get repeat count
    const repeatTimes = this.config.get ? 
      this.config.getRepeatTimes('transfer', 1) : 
      (this.config.operations?.transfer?.repeat_times || 1);
    
    this.logger.info(`Will perform ${count} self-transfers, repeated ${repeatTimes} time(s)`);
    
    // Display configuration
    const usePercentage = this.config.get ? 
      this.config.getBoolean('operations.transfer.use_percentage', true) : 
      (this.config.operations?.transfer?.use_percentage ?? true);
    
    if (!usePercentage) {
      const fixedAmount = this.config.get ? 
        this.config.get('operations.transfer.fixed_amount', {}) : 
        (this.config.operations?.transfer?.fixed_amount || {});
      
      this.logger.info(`Using fixed amount: min=${fixedAmount.min}, max=${fixedAmount.max}, decimals=${fixedAmount.decimals}`);
    } else {
      const percentage = this.config.get ? 
        this.config.getNumber('operations.transfer.percentage', 90) : 
        (this.config.operations?.transfer?.percentage || 90);
      
      this.logger.info(`Using percentage-based amount: ${percentage}% of wallet balance`);
    }
    
    let totalSuccess = 0;
    for (let r = 0; r < repeatTimes; r++) {
      let successCount = 0;
      
      // Reset nonce for each repeat cycle
      this.blockchain.resetNonce();
      
      for (let i = 1; i <= count; i++) {
        const success = await this.executeTransfer(i, count);
        if (success) {
          successCount++;
          totalSuccess++;
        }
        
        // Add delay between transfers if not the last one
        if (i < count) {
          await this.addDelay(`next transfer (${i+1}/${count})`);
        }
      }
      
      // Add delay between repeat cycles if not the last one
      if (r < repeatTimes - 1) {
        this.logger.info(`Completed repeat cycle ${r+1}/${repeatTimes}`);
        await this.addDelay(`next repeat cycle (${r+2}/${repeatTimes})`);
      }
    }
    
    this.logger.success(`Self-transfer operations completed: ${totalSuccess}/${count * repeatTimes} successful transfers`);
    return totalSuccess > 0;
  }
}

module.exports = Transfer;