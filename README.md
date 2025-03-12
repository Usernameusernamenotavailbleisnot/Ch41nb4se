# Ch41nb4se

A comprehensive automation tool for interacting with the Ch41nb4se Testnet environment. This tool helps automate various blockchain operations to simplify testing and development workflows.

## Features

- **Multi-wallet support**: Process multiple wallets in sequence
- **Network bridging**: Bridge tokens between Sepolia and Ch41nb4se networks
- **ETH transfers**: Automated self-transfers with configurable amounts
- **Smart contract deployment**: Deploy and interact with various smart contracts
- **Token operations**: Create and manage ERC20 tokens and NFT collections
- **Contract testing**: Run test sequences against deployed contracts
- **Batch operations**: Execute multiple operations in a single transaction
- **Proxy support**: Use HTTP or SOCKS5 proxies for connections
- **Operation randomization**: Randomize operations for more realistic testing
- **Extensive logging**: Detailed logs for monitoring and debugging

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Usernameusernamenotavailbleisnot/Ch41nb4se
   cd Ch41nb4se
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your private keys:
   - Create a `data` directory in the project root if it doesn't exist
   - Create a file named `pk.txt` in the `data` directory
   - Add one private key per line (without the '0x' prefix)

4. (Optional) Set up proxies:
   - Create a file named `proxy.txt` in the `data` directory
   - Add one proxy per line in the format `ip:port` or `username:password@ip:port`

## Configuration

The tool is configured using `config.json` in the project root. A default configuration will be created if it doesn't exist.

Key configuration options:

```json
{
  "operations": {
    "bridge": {
      "enabled": false,
      "sepolia_to_Ch41nb4se": { "enabled": true },
      "Ch41nb4se_to_sepolia": { "enabled": true },
      "repeat_times": 1
    },
    "transfer": {
      "enabled": true,
      "use_percentage": true,
      "percentage": 90,
      "repeat_times": 2
    },
    "contract_deploy": { "enabled": true },
    "contract_testing": { "enabled": true },
    "erc20": { "enabled": true },
    "nft": { "enabled": true },
    "batch_operations": { "enabled": true }
  },
  "general": {
    "gas_price_multiplier": 1.05,
    "max_retries": 1,
    "log_level": "info"
  },
  "proxy": {
    "enabled": false,
    "type": "http",
    "rotation": { "enabled": false }
  },
  "randomization": {
    "enable": false,
    "excluded_operations": ["bridge"]
  }
}
```

## Usage

Start the automation process:

```
npm start
```

The tool will:
1. Load configuration and private keys
2. Initialize proxy settings if enabled
3. Process each wallet sequentially, performing the enabled operations
4. Wait 8 hours before starting the next cycle

## Operation Details

### Bridge
Bridges ETH between Sepolia Testnet and Ch41nb4se Testnet.

### Transfer
Performs self-transfers of ETH with either fixed amounts or percentage-based amounts.

### Contract Deploy
Deploys sample contracts with automated interaction sequences.

### Contract Testing
Tests deployed contracts with various parameter values and operation sequences.

### ERC20
Creates custom ERC20 tokens with mint and burn operations.

### NFT
Creates NFT collections with mint and burn capabilities.

### Batch Operations
Executes multiple operations in a single transaction for efficiency.


## Logs

Logs are saved to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and testing purposes only. Please use responsibly and in accordance with the terms of service of the networks you interact with.
