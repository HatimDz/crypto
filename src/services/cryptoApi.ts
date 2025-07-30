class CryptoApiService {
  private static instance: CryptoApiService;

  private constructor() {}

  public static getInstance(): CryptoApiService {
    if (!CryptoApiService.instance) {
      CryptoApiService.instance = new CryptoApiService();
    }
    return CryptoApiService.instance;
  }
}

export default CryptoApiService.getInstance();
