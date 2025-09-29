import { isValidAddress } from '@ton/core';

export interface TonBalanceResult {
  balance: string;
  balanceNano: string;
  isValid: boolean;
  error?: string;
}

export interface TonApiConfig {
  mainnetApiKey?: string;
  testnetApiKey?: string;
  isMainnet: boolean;
  timeout?: number;
}

export class TonBalanceFetcher {
  private config: TonApiConfig;

  constructor(config: TonApiConfig) {
    this.config = {
      timeout: 10000,
      ...config
    };
  }

  /**
   * Fetch TON balance for a given address
   */
  async fetchBalance(address: string): Promise<TonBalanceResult> {
    if (!address || !isValidAddress(address)) {
      return {
        balance: '0',
        balanceNano: '0',
        isValid: false,
        error: 'Invalid TON address'
      };
    }

    try {
      const apiKey = this.config.isMainnet 
        ? this.config.mainnetApiKey 
        : this.config.testnetApiKey;
      
      const baseUrl = this.config.isMainnet 
        ? 'https://toncenter.com/api/v2' 
        : 'https://testnet.toncenter.com/api/v2';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(
        `${baseUrl}/getAddressBalance?address=${address}`,
        {
          headers: apiKey ? { 'X-API-Key': apiKey } : {},
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.ok) {
        const balanceNano = data.result;
        const balanceInTon = (parseInt(balanceNano) / 1_000_000_000).toFixed(4);
        
        return {
          balance: balanceInTon,
          balanceNano,
          isValid: true
        };
      } else {
        throw new Error(data.error || 'API returned error');
      }
    } catch (error) {
      console.error('Error fetching TON balance:', error);
      
      let errorMessage = 'Failed to fetch balance';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        balance: '0',
        balanceNano: '0',
        isValid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Fetch multiple balances in parallel
   */
  async fetchMultipleBalances(addresses: string[]): Promise<Map<string, TonBalanceResult>> {
    const results = new Map<string, TonBalanceResult>();
    
    const promises = addresses.map(async (address) => {
      const result = await this.fetchBalance(address);
      results.set(address, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Validate TON address format
   */
  static validateAddress(address: string): boolean {
    return isValidAddress(address);
  }

  /**
   * Format TON balance for display
   */
  static formatBalance(balance: string, decimals: number = 4): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    
    return num.toFixed(decimals);
  }

  /**
   * Convert TON to nanoTON
   */
  static tonToNano(ton: string | number): string {
    const tonNum = typeof ton === 'string' ? parseFloat(ton) : ton;
    return (tonNum * 1_000_000_000).toString();
  }

  /**
   * Convert nanoTON to TON
   */
  static nanoToTon(nano: string | number): string {
    const nanoNum = typeof nano === 'string' ? parseInt(nano) : nano;
    return (nanoNum / 1_000_000_000).toFixed(9);
  }
}

// Default instance with environment configuration
export const defaultTonFetcher = new TonBalanceFetcher({
  mainnetApiKey: process.env.REACT_APP_TONCENTER_API_KEY,
  testnetApiKey: process.env.REACT_APP_TONCENTER_TESTNET_API_KEY,
  isMainnet: process.env.REACT_APP_NETWORK === 'mainnet' || true
});

export default TonBalanceFetcher;
