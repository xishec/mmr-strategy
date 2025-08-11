import { MarketData } from "./models";
import { DATA_CONFIG } from "./data-config";

/**
 * Service for loading market data from remote GitHub URLs
 */
export class DataService {
  private static instance: DataService;
  private marketDataCache: MarketData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = DATA_CONFIG.CACHE_DURATION_MS;

  private constructor() {}

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /**
   * Fetch data from a remote URL with timeout and error handling
   */
  private async fetchFromUrl(url: string, timeout: number = 10000): Promise<any> {
    console.log(`Attempting to fetch from: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`Request timeout after ${timeout}ms for ${url}`);
      controller.abort();
    }, timeout);

    try {
      console.log("Fetch request initiated with options:", {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/json,text/plain,*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json,text/plain,*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      console.log(`Response received: status=${response.status}, ok=${response.ok}`);
      console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);

      const text = await response.text();
      console.log(`Response text length: ${text.length}, first 100 chars: ${text.substring(0, 100)}`);
      
      const data = JSON.parse(text);
      console.log(`Successfully parsed JSON data with ${Object.keys(data).length} entries`);
      console.log(`Successfully loaded data from ${url}`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        console.error(`Detailed fetch error for ${url}:`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      } else {
        console.error(`Unknown error type for ${url}:`, error);
      }
      
      console.warn(`Failed to load data from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Try multiple fetch strategies to overcome various network/CORS issues
   */
  private async fetchWithMultipleStrategies(url: string): Promise<any> {
    const strategies = [
      // Strategy 1: Standard fetch with explicit CORS settings
      async () => {
        console.log("Trying strategy 1: Standard fetch with CORS");
        return this.fetchFromUrl(url, 15000);
      },
      
      // Strategy 2: Fetch with different headers
      async () => {
        console.log("Trying strategy 2: Fetch with minimal headers");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      
      // Strategy 3: Try with XMLHttpRequest as fallback
      async () => {
        console.log("Trying strategy 3: XMLHttpRequest");
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 15000;
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (parseError) {
                reject(new Error(`Failed to parse JSON: ${parseError}`));
              }
            } else {
              reject(new Error(`XHR error! status: ${xhr.status}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('XHR network error'));
          xhr.ontimeout = () => reject(new Error('XHR timeout'));
          
          xhr.open('GET', url, true);
          xhr.send();
        });
      }
    ];

    let lastError: Error | null = null;
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Attempting fetch strategy ${i + 1}/${strategies.length} for ${url}`);
        const result = await strategies[i]();
        console.log(`Strategy ${i + 1} succeeded for ${url}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Strategy ${i + 1} failed for ${url}:`, lastError.message);
        
        // Add small delay between strategies
        if (i < strategies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.error(`All fetch strategies failed for ${url}`);
    throw lastError || new Error('All fetch strategies failed');
  }

  /**
   * Load data from local files (for development)
   */
  private async loadFromLocalFiles(): Promise<MarketData> {
    try {
      console.log("Loading data from local files...");
      const marketData = {
        QQQ: (await import("../data/QQQ.json")).default,
        TQQQ: (await import("../data/TQQQ.json")).default,
      };
      console.log("Successfully loaded data from local files");
      return marketData;
    } catch (error) {
      console.error("Failed to load local data:", error);
      throw new Error("Failed to load market data from local files");
    }
  }

  /**
   * Determine if we should use cached data
   */
  private shouldUseCache(): boolean {
    return (
      this.marketDataCache !== null &&
      Date.now() - this.lastFetchTime < this.CACHE_DURATION
    );
  }

  /**
   * Main method to load market data from remote URLs or local files
   */
  public async loadMarketData(): Promise<MarketData> {
    // Return cached data if available and fresh
    if (this.shouldUseCache()) {
      console.log("Using cached market data");
      return this.marketDataCache!;
    }

    // Use local files in development due to CORS restrictions
    if (DATA_CONFIG.USE_LOCAL_IN_DEVELOPMENT) {
      console.log("Development mode: using local files");
      this.marketDataCache = await this.loadFromLocalFiles();
      this.lastFetchTime = Date.now();
      return this.marketDataCache;
    }

    console.log("Production mode: attempting to load data from remote URLs...");
    
    // Try dynamic import first (works better in some hosting environments)
    try {
      console.log("Attempting dynamic import method...");
      const marketData = await this.loadViaDynamicImport();
      this.marketDataCache = marketData;
      this.lastFetchTime = Date.now();
      console.log("Successfully loaded data via dynamic import");
      return marketData;
    } catch (dynamicImportError) {
      console.warn("Dynamic import failed, falling back to fetch:", dynamicImportError);
    }

    // Fallback to fetch method
    const qqqUrl = DATA_CONFIG.QQQ_DATA_URL;
    const tqqqUrl = DATA_CONFIG.TQQQ_DATA_URL;
    
    // Fetch both datasets in parallel
    const [qqqData, tqqqData] = await Promise.all([
      this.fetchFromUrl(qqqUrl),
      this.fetchFromUrl(tqqqUrl),
    ]);

    const marketData: MarketData = {
      QQQ: qqqData,
      TQQQ: tqqqData,
    };

    // Cache the successful result
    this.marketDataCache = marketData;
    this.lastFetchTime = Date.now();

    console.log("Successfully loaded data from remote URLs");
    return marketData;
  }

  /**
   * Try to load data via dynamic import (for environments where fetch might be restricted)
   */
  private async loadViaDynamicImport(): Promise<MarketData> {
    console.log("Trying alternative loading methods...");

    // Method 1: Try with different fetch options
    try {
      console.log("Method 1: Fetch with mode: 'cors'");
      const [qqqData, tqqqData] = await Promise.all([
        this.fetchWithCorsMode(DATA_CONFIG.QQQ_DATA_URL),
        this.fetchWithCorsMode(DATA_CONFIG.TQQQ_DATA_URL),
      ]);
      
      return { QQQ: qqqData, TQQQ: tqqqData };
    } catch (error) {
      console.warn("Method 1 failed:", error);
    }

    // Method 2: Try with different headers
    try {
      console.log("Method 2: Fetch with different headers");
      const [qqqData, tqqqData] = await Promise.all([
        this.fetchWithDifferentHeaders(DATA_CONFIG.QQQ_DATA_URL),
        this.fetchWithDifferentHeaders(DATA_CONFIG.TQQQ_DATA_URL),
      ]);
      
      return { QQQ: qqqData, TQQQ: tqqqData };
    } catch (error) {
      console.warn("Method 2 failed:", error);
    }

    // Method 3: Try with CORS proxy
    try {
      console.log("Method 3: Using CORS proxy");
      const [qqqData, tqqqData] = await Promise.all([
        this.fetchWithCorsProxy(DATA_CONFIG.QQQ_DATA_URL),
        this.fetchWithCorsProxy(DATA_CONFIG.TQQQ_DATA_URL),
      ]);
      
      return { QQQ: qqqData, TQQQ: tqqqData };
    } catch (error) {
      console.warn("Method 3 failed:", error);
    }

    throw new Error("All dynamic loading methods failed");
  }

  private async fetchWithCorsMode(url: string): Promise<any> {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async fetchWithDifferentHeaders(url: string): Promise<any> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async fetchWithCorsProxy(url: string): Promise<any> {
    // Using a public CORS proxy service
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`CORS proxy error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status.http_code !== 200) {
      throw new Error(`CORS proxy returned error: ${data.status.http_code}`);
    }

    return JSON.parse(data.contents);
  }

  /**
   * Force refresh data (bypass cache)
   */
  public async refreshData(): Promise<MarketData> {
    this.marketDataCache = null;
    this.lastFetchTime = 0;
    return this.loadMarketData();
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.marketDataCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Get the timestamp of when data was last fetched
   */
  public getLastFetchTime(): number {
    return this.lastFetchTime;
  }
}
