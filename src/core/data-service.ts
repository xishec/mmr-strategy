import { MarketData } from "./models";

/**
 * Service for loading market data either from remote URLs or local files
 */
export class DataService {
  private static instance: DataService;
  private marketDataCache: MarketData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Successfully loaded data from ${url}`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Failed to load data from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Load data from local files as fallback
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
   * Main method to load market data with remote fetch and local fallback
   */
  public async loadMarketData(): Promise<MarketData> {
    // Return cached data if available and fresh
    if (this.shouldUseCache()) {
      console.log("Using cached market data");
      return this.marketDataCache!;
    }

    const qqqUrl = process.env.REACT_APP_QQQ_DATA_URL;
    const tqqqUrl = process.env.REACT_APP_TQQQ_DATA_URL;
    const useLocalFallback = process.env.REACT_APP_USE_LOCAL_FALLBACK === 'true';

    // If no URLs are configured, use local files
    if (!qqqUrl || !tqqqUrl) {
      console.log("No remote URLs configured, using local files");
      this.marketDataCache = await this.loadFromLocalFiles();
      this.lastFetchTime = Date.now();
      return this.marketDataCache;
    }

    try {
      console.log("Attempting to load data from remote URLs...");
      
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

    } catch (error) {
      console.warn("Failed to load data from remote URLs:", error);
      
      if (useLocalFallback) {
        console.log("Falling back to local files...");
        this.marketDataCache = await this.loadFromLocalFiles();
        this.lastFetchTime = Date.now();
        return this.marketDataCache;
      } else {
        throw new Error("Failed to load market data and fallback is disabled");
      }
    }
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
}
