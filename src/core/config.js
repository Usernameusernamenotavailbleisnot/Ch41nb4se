// Configuration management
const fs = require('fs').promises;
const _ = require('lodash');
const logger = require('../utils/logger');

class Config {
  constructor() {
    this.config = {};
    this.walletNum = null;
    this.logger = logger.getInstance();
  }

  async load() {
    try {
      const jsonExists = await fs.access('config.json').then(() => true).catch(() => false);
      if (jsonExists) {
        this.logger.success(`Found config.json`);
        const jsonContent = await fs.readFile('config.json', 'utf8');
        this.config = JSON.parse(jsonContent);
      } else {
        this.logger.warn(`No configuration file found, using defaults`);
        this.config = this.getDefaults();
      }
      return this.config;
    } catch (error) {
      this.logger.error(`Error loading configuration: ${error.message}`);
      this.config = this.getDefaults();
      return this.config;
    }
  }

  getDefaults() {
    return {
      operations: {
        bridge: {
          enabled: false,
          amount: {
            min: 0.0001,
            max: 0.0004,
            decimals: 7
          },
          sepolia_to_chainbase: {
            enabled: true,
            amount: {
              min: 0.0001,
              max: 0.0003,
              decimals: 7
            }
          },
          chainbase_to_sepolia: {
            enabled: true,
            amount: {
              min: 0.0001,
              max: 0.0003,
              decimals: 6
            }
          },
          repeat_times: 1
        },
        transfer: {
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
          repeat_times: 2
        },
        contract_deploy: {
          enabled: true,
          interactions: {
            enabled: true,
            count: {
              min: 3,
              max: 8
            },
            types: ["setValue", "increment", "decrement", "reset", "contribute"]
          }
        },
        contract_testing: {
          enabled: true,
          test_sequences: ["parameter_variation", "stress_test", "boundary_test"],
          iterations: {
            min: 2,
            max: 3
          }
        },
        random_contract: {
          enabled: true,
          max_gas: 3000000,
          repeat_times: 1
        },
        random_token: {
          enabled: true,
          max_gas: 3000000,
          supply: {
            min: 1000000,
            max: 10000000
          },
          repeat_times: 1
        },
        erc20: {
          enabled: true,
          mint_amount: {
            min: 1000000,
            max: 10000000
          },
          burn_percentage: 10,
          decimals: 18
        },
        nft: {
          enabled: true,
          mint_count: {
            min: 2,
            max: 5
          },
          burn_percentage: 20,
          supply: {
            min: 100,
            max: 500
          }
        },
        batch_operations: {
          enabled: true,
          operations_per_batch: {
            min: 2,
            max: 3
          }
        }
      },
      general: {
        gas_price_multiplier: 1.2,
        max_retries: 5,
        base_wait_time: 10,
        delay: {
          min_seconds: 5,
          max_seconds: 30
        }
      },
      proxy: {
        enabled: false,
        type: "http",
        rotation: {
          enabled: true,
          per_operation: false
        }
      },
      randomization: {
        enable: true,
        excluded_operations: [],
        operations_to_run: ["bridge", "transfer", "contract_deploy", "contract_testing", "erc20", "nft", "batch_operations", "random_contract", "random_token"]
      }
    };
  }

  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
    return this;
  }

  get(path, defaultValue) {
    return _.get(this.config, path, defaultValue);
  }

  getNumber(path, defaultValue = 0) {
    return Number(this.get(path, defaultValue));
  }

  getBoolean(path, defaultValue = false) {
    return Boolean(this.get(path, defaultValue));
  }

  getString(path, defaultValue = '') {
    return String(this.get(path, defaultValue));
  }

  getArray(path, defaultValue = []) {
    const value = this.get(path, defaultValue);
    return Array.isArray(value) ? value : defaultValue;
  }

  isEnabled(feature) {
    return this.getBoolean(`operations.${feature}.enabled`, this.getBoolean(`${feature}.enabled`, false));
  }

  getRange(feature, property, defaultMin = 1, defaultMax = 10) {
    const minValue = this.getNumber(`operations.${feature}.${property}.min`, 
                       this.getNumber(`${feature}.${property}.min`, defaultMin));
    
    let maxValue = this.getNumber(`operations.${feature}.${property}.max`, 
                     this.getNumber(`${feature}.${property}.max`, defaultMax));
    
    if (minValue > maxValue) {
      this.logger.warn(`Invalid range for ${feature}.${property}: min (${minValue}) > max (${maxValue}). Using min value.`);
      maxValue = minValue;
    }
    
    return { min: minValue, max: maxValue };
  }

  getRandomInRange(feature, property, defaultMin = 1, defaultMax = 10) {
    const range = this.getRange(feature, property, defaultMin, defaultMax);
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  getDelayConfig() {
    return this.config.general?.delay || this.config.delay || { min_seconds: 5, max_seconds: 30 };
  }

  getRepeatTimes(feature, defaultValue = 1) {
    return this.getNumber(`operations.${feature}.repeat_times`, this.getNumber(`${feature}.repeat_times`, defaultValue));
  }

  getGasPriceMultiplier() {
    return this.getNumber('general.gas_price_multiplier', 1.2);
  }

  set(path, value) {
    _.set(this.config, path, value);
    return this;
  }

  getRandomizedOperations(allOperations) {
    const randomizationConfig = this.get('randomization', { 
      enable: false, 
      excluded_operations: [],
      operations_to_run: allOperations.map(op => op.name)
    });
    
    const operationsToRun = randomizationConfig.operations_to_run || allOperations.map(op => op.name);
    const filteredOperations = allOperations.filter(op => operationsToRun.includes(op.name));
    
    const excludedOps = randomizationConfig.excluded_operations || [];
    const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
    const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
    
    if (randomizationConfig.enable && randomizableOps.length > 1) {
      this.shuffleArray(randomizableOps);
    }
    
    return [...fixedOps, ...randomizableOps];
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

module.exports = new Config();