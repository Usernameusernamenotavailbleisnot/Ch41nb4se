// Application constants
module.exports = {
    // Network information for Chainbase
    NETWORK: {
      NAME: "Chainbase Network Testnet",
      CHAIN_ID: 2233,
      RPC_URL: "https://testnet.s.chainbase.com",
      EXPLORER_URL: "https://testnet.explorer.chainbase.com",
      CURRENCY_SYMBOL: "ETH"
    },
    
    // Sepolia testnet information
    SEPOLIA: {
      NAME: "Sepolia Testnet",
      CHAIN_ID: 11155111,
      RPC_URL: "https://eth-sepolia.public.blastapi.io",
      EXPLORER_URL: "https://sepolia.etherscan.io"
    },
    
    // Bridge information
    BRIDGE: {
      SEPOLIA_TO_CHAINBASE: {
        API_URL: "https://api.superbridge.app/api/v2/bridge/routes",
        REFERER: "https://testnet.bridge.chainbase.com/",
        ORIGIN: "https://testnet.bridge.chainbase.com",
        INBOX_ADDRESS: "0xCa1140786D67e6c91F4c826356d1494D595A9E07",
        DEPOSIT_FUNCTION: "0xe11013dd"
      },
      CHAINBASE_TO_SEPOLIA: {
        API_URL: "https://api.superbridge.app/api/v2/bridge/routes",
        REFERER: "https://testnet.bridge.chainbase.com/",
        ORIGIN: "https://testnet.bridge.chainbase.com",
        OUTBOX_ADDRESS: "0x4200000000000000000000000000000000000010",
        WITHDRAWAL_FUNCTION: "0xe11013dd"
      }
    },
    
    // Gas settings
    GAS: {
      PRICE_MULTIPLIER: 1.1,
      RETRY_INCREASE: 1.3,
      MIN_GWEI: 0.0001,
      MAX_GWEI: 200,
      DEFAULT_GAS: 150000,
    },
    
    // Retry settings
    RETRY: {
      MAX_RETRIES: 5,
      BASE_WAIT_TIME: 10,
      RETRY_DELAY_BASE: 5000,
      RETRY_DELAY_EXTRA: 5000,
      MEMPOOL_RETRY_MULTIPLIER: 3
    },
    
    // Contract deployment templates
    CONTRACT: {
      SAMPLE_CONTRACT_SOURCE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract InteractiveContract {
          address public owner;
          uint256 public value;
          uint256 public interactionCount;
          string public lastAction;
          mapping(address => uint256) public contributions;
          
          event ValueUpdated(address indexed by, uint256 newValue, string actionType);
          event Contributed(address indexed contributor, uint256 amount);
          
          constructor() {
              owner = msg.sender;
              value = 0;
              interactionCount = 0;
              lastAction = "Contract created";
          }
          
          function setValue(uint256 _value) public {
              value = _value;
              interactionCount++;
              lastAction = "setValue";
              emit ValueUpdated(msg.sender, _value, "setValue");
          }
          
          function increment() public {
              value++;
              interactionCount++;
              lastAction = "increment";
              emit ValueUpdated(msg.sender, value, "increment");
          }
          
          function decrement() public {
              if (value > 0) {
                  value--;
              }
              interactionCount++;
              lastAction = "decrement";
              emit ValueUpdated(msg.sender, value, "decrement");
          }
          
          function contribute() public payable {
              require(msg.value > 0, "Contribution must be greater than 0");
              contributions[msg.sender] += msg.value;
              interactionCount++;
              lastAction = "contribute";
              emit Contributed(msg.sender, msg.value);
          }
          
          function getStats() public view returns (uint256, uint256, string memory) {
              return (value, interactionCount, lastAction);
          }
          
          function reset() public {
              require(msg.sender == owner, "Only owner can reset");
              value = 0;
              interactionCount++;
              lastAction = "reset";
              emit ValueUpdated(msg.sender, 0, "reset");
          }
      }
      `
    },
    
    // ERC20 token settings
    ERC20: {
      TOKEN_NAME_PREFIXES: [
        'Moon', 'Doge', 'Shib', 'Pepe', 'Ape', 'Baby', 'Safe', 'Floki', 'Elon', 'Mars',
        'Space', 'Rocket', 'Diamond', 'Crypto', 'Meme', 'Chad', 'Bull', 'Super', 'Mega', 'Meta'
      ],
      TOKEN_NAME_SUFFIXES: [
        'Coin', 'Token', 'Cash', 'Swap', 'Inu', 'Dao', 'Moon', 'Doge', 'Chain', 'Finance',
        'Protocol', 'Network', 'Exchange', 'Capital', 'Money', 'Rocket', 'Rise', 'Gains', 'Pump', 'Whale'
      ],
      CONTRACT_TEMPLATE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract {{CONTRACT_NAME}} {
          string public name;
          string public symbol;
          uint8 public decimals;
          uint256 public totalSupply;
          
          address public owner;
          
          mapping(address => uint256) private _balances;
          mapping(address => mapping(address => uint256)) private _allowances;
          
          event Transfer(address indexed from, address indexed to, uint256 value);
          event Approval(address indexed owner, address indexed spender, uint256 value);
          event Mint(address indexed to, uint256 value);
          event Burn(address indexed from, uint256 value);
          
          modifier onlyOwner() {
              require(msg.sender == owner, "Only owner can call this function");
              _;
          }
          
          constructor(string memory _name, string memory _symbol, uint8 _decimals) {
              name = _name;
              symbol = _symbol;
              decimals = _decimals;
              totalSupply = 0;
              owner = msg.sender;
          }
          
          function balanceOf(address account) public view returns (uint256) {
              return _balances[account];
          }
          
          function transfer(address to, uint256 amount) public returns (bool) {
              _transfer(msg.sender, to, amount);
              return true;
          }
          
          function allowance(address owner, address spender) public view returns (uint256) {
              return _allowances[owner][spender];
          }
          
          function approve(address spender, uint256 amount) public returns (bool) {
              _approve(msg.sender, spender, amount);
              return true;
          }
          
          function transferFrom(address from, address to, uint256 amount) public returns (bool) {
              require(_allowances[from][msg.sender] >= amount, "ERC20: insufficient allowance");
              
              _allowances[from][msg.sender] -= amount;
              _transfer(from, to, amount);
              
              return true;
          }
          
          function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
              _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
              return true;
          }
          
          function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
              uint256 currentAllowance = _allowances[msg.sender][spender];
              require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
              
              _approve(msg.sender, spender, currentAllowance - subtractedValue);
              return true;
          }
          
          function mint(address to, uint256 amount) public onlyOwner {
              require(to != address(0), "ERC20: mint to the zero address");
              
              totalSupply += amount;
              _balances[to] += amount;
              
              emit Transfer(address(0), to, amount);
              emit Mint(to, amount);
          }
          
          function burn(uint256 amount) public {
              require(_balances[msg.sender] >= amount, "ERC20: burn amount exceeds balance");
              
              _balances[msg.sender] -= amount;
              totalSupply -= amount;
              
              emit Transfer(msg.sender, address(0), amount);
              emit Burn(msg.sender, amount);
          }
          
          function _transfer(address from, address to, uint256 amount) internal {
              require(from != address(0), "ERC20: transfer from the zero address");
              require(to != address(0), "ERC20: transfer to the zero address");
              require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");
              
              _balances[from] -= amount;
              _balances[to] += amount;
              
              emit Transfer(from, to, amount);
          }
          
          function _approve(address owner, address spender, uint256 amount) internal {
              require(owner != address(0), "ERC20: approve from the zero address");
              require(spender != address(0), "ERC20: approve to the zero address");
              
              _allowances[owner][spender] = amount;
              
              emit Approval(owner, spender, amount);
          }
      }
      `
    },
    
    // NFT collection settings
    NFT: {
      NAME_PREFIXES: [
        'Crypto', 'Bored', 'Mutant', 'Azuki', 'Doodle', 'Pudgy', 'Cool', 'Lazy', 'Cyber', 'Meta'
      ],
      NAME_SUFFIXES: [
        'Apes', 'Monkeys', 'Punks', 'Cats', 'Dogs', 'Bears', 'Club', 'Society', 'Gang', 'Legends'
      ],
      CONTRACT_TEMPLATE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract {{CONTRACT_NAME}} {
          // Contract owner
          address public owner;
          
          // Collection info
          string public name;
          string public symbol;
          uint256 public maxSupply;
          uint256 public totalSupply;
          
          // Token mappings
          mapping(uint256 => address) private _owners;
          mapping(address => uint256) private _balances;
          mapping(uint256 => string) private _tokenURIs;
          
          // Events
          event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
          event Mint(address indexed to, uint256 indexed tokenId, string tokenURI);
          event Burn(address indexed from, uint256 indexed tokenId);
          
          // Modifiers
          modifier onlyOwner() {
              require(msg.sender == owner, "Not the contract owner");
              _;
          }
          
          modifier tokenExists(uint256 tokenId) {
              require(_owners[tokenId] != address(0), "Token doesn't exist");
              _;
          }
          
          constructor(string memory _name, string memory _symbol, uint256 _maxSupply) {
              owner = msg.sender;
              name = _name;
              symbol = _symbol;
              maxSupply = _maxSupply;
              totalSupply = 0;
          }
          
          function mint(address to, uint256 tokenId, string memory tokenURI) public onlyOwner {
              require(to != address(0), "Cannot mint to zero address");
              require(_owners[tokenId] == address(0), "Token already exists");
              require(totalSupply < maxSupply, "Maximum supply reached");
              
              _owners[tokenId] = to;
              _balances[to]++;
              _tokenURIs[tokenId] = tokenURI;
              totalSupply++;
              
              emit Transfer(address(0), to, tokenId);
              emit Mint(to, tokenId, tokenURI);
          }
          
          function burn(uint256 tokenId) public tokenExists(tokenId) {
              address tokenOwner = _owners[tokenId];
              
              // Only token owner or contract owner can burn
              require(msg.sender == tokenOwner || msg.sender == owner, "Not authorized to burn");
              
              // Clear token data
              delete _tokenURIs[tokenId];
              delete _owners[tokenId];
              _balances[tokenOwner]--;
              totalSupply--;
              
              emit Transfer(tokenOwner, address(0), tokenId);
              emit Burn(tokenOwner, tokenId);
          }
          
          function tokenURI(uint256 tokenId) public view tokenExists(tokenId) returns (string memory) {
              return _tokenURIs[tokenId];
          }
          
          function ownerOf(uint256 tokenId) public view tokenExists(tokenId) returns (address) {
              return _owners[tokenId];
          }
          
          function balanceOf(address _owner) public view returns (uint256) {
              require(_owner != address(0), "Zero address has no balance");
              return _balances[_owner];
          }
          
          function tokensOfOwner(address _owner) public view returns (uint256[] memory) {
              uint256 tokenCount = _balances[_owner];
              uint256[] memory tokenIds = new uint256[](tokenCount);
              
              uint256 counter = 0;
              for (uint256 i = 0; i < maxSupply && counter < tokenCount; i++) {
                  if (_owners[i] == _owner) {
                      tokenIds[counter] = i;
                      counter++;
                  }
              }
              
              return tokenIds;
          }
      }
      `
    },
    
    // Contract testing
    CONTRACT_TESTING: {
      TEST_CONTRACT_SOURCE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract ParameterTesterContract {
          address public owner;
          uint256 public value;
          string public lastOperation;
          uint256 public operationCount;
          
          event ValueSet(address indexed by, uint256 newValue);
          event ValueAdded(address indexed by, uint256 addedValue, uint256 newValue);
          event ValueSubtracted(address indexed by, uint256 subtractedValue, uint256 newValue);
          
          constructor() {
              owner = msg.sender;
              value = 0;
              lastOperation = "constructor";
              operationCount = 0;
          }
          
          function setValue(uint256 _value) public {
              value = _value;
              lastOperation = "setValue";
              operationCount++;
              emit ValueSet(msg.sender, _value);
          }
          
          function getValue() public view returns (uint256) {
              return value;
          }
          
          function addValue(uint256 _value) public {
              uint256 oldValue = value;
              value += _value;
              
              // Check for overflow
              require(value >= oldValue, "Addition overflow");
              
              lastOperation = "addValue";
              operationCount++;
              emit ValueAdded(msg.sender, _value, value);
          }
          
          function subtractValue(uint256 _value) public {
              require(value >= _value, "Cannot subtract more than current value");
              
              value -= _value;
              lastOperation = "subtractValue";
              operationCount++;
              emit ValueSubtracted(msg.sender, _value, value);
          }
          
          function getOperationStats() public view returns (string memory, uint256) {
              return (lastOperation, operationCount);
          }
      }
      `
    },
    
    // Batch operation
    BATCH: {
      PROCESSOR_CONTRACT: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
      
      contract BatchProcessor {
          address public owner;
          uint256 public operationCount;
          uint256 public lastValue;
          mapping(uint256 => string) public operations;
          
          event OperationExecuted(uint256 indexed opId, string operationType);
          event BatchProcessed(uint256 operationCount);
          
          constructor() {
              owner = msg.sender;
              operationCount = 0;
              lastValue = 0;
          }
          
          function setValue(uint256 _value) public {
              lastValue = _value;
              operations[operationCount] = "setValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "setValue");
          }
          
          function incrementValue() public {
              lastValue++;
              operations[operationCount] = "incrementValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "incrementValue");
          }
          
          function decrementValue() public {
              if (lastValue > 0) {
                  lastValue--;
              }
              operations[operationCount] = "decrementValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "decrementValue");
          }
          
          function squareValue() public {
              lastValue = lastValue * lastValue;
              operations[operationCount] = "squareValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "squareValue");
          }
          
          function resetValue() public {
              lastValue = 0;
              operations[operationCount] = "resetValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "resetValue");
          }
          
          function multiplyValue(uint256 _multiplier) public {
              lastValue = lastValue * _multiplier;
              operations[operationCount] = "multiplyValue";
              operationCount++;
              emit OperationExecuted(operationCount - 1, "multiplyValue");
          }
          
          function executeBatch(string[] memory batchOperations, uint256[] memory parameters) public {
              require(batchOperations.length > 0, "Empty batch");
              require(batchOperations.length == parameters.length, "Operations and parameters length mismatch");
              
              uint256 initialOpCount = operationCount;
              
              for (uint256 i = 0; i < batchOperations.length; i++) {
                  bytes32 opHash = keccak256(abi.encodePacked(batchOperations[i]));
                  
                  if (opHash == keccak256(abi.encodePacked("setValue"))) {
                      setValue(parameters[i]);
                  } else if (opHash == keccak256(abi.encodePacked("incrementValue"))) {
                      incrementValue();
                  } else if (opHash == keccak256(abi.encodePacked("decrementValue"))) {
                      decrementValue();
                  } else if (opHash == keccak256(abi.encodePacked("squareValue"))) {
                      squareValue();
                  } else if (opHash == keccak256(abi.encodePacked("resetValue"))) {
                      resetValue();
                  } else if (opHash == keccak256(abi.encodePacked("multiplyValue"))) {
                      multiplyValue(parameters[i]);
                  } else {
                      revert("Unknown operation");
                  }
              }
              
              emit BatchProcessed(operationCount - initialOpCount);
          }
          
          function getStatus() public view returns (uint256, uint256) {
              return (operationCount, lastValue);
          }
      }
      `
    },
    
    // Version information
    VERSION: {
      APP: "1.2.0",
      CONFIG_SCHEMA: "1.0",
      BUILD_DATE: "2025-03-12"
    }
  };