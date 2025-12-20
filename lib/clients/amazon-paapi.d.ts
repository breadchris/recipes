declare module 'amazon-paapi' {
  interface CommonParameters {
    AccessKey: string;
    SecretKey: string;
    PartnerTag: string;
    PartnerType: 'Associates';
    Marketplace: string;
  }

  interface SearchItemsParameters {
    Keywords: string;
    SearchIndex: string;
    ItemCount?: number;
    Resources?: string[];
  }

  interface PriceInfo {
    DisplayAmount?: string;
    Amount?: number;
    Currency?: string;
  }

  interface OfferListing {
    Price?: PriceInfo;
  }

  interface ImageInfo {
    URL?: string;
    Height?: number;
    Width?: number;
  }

  interface SearchItem {
    ASIN: string;
    ItemInfo?: {
      Title?: {
        DisplayValue?: string;
      };
    };
    Offers?: {
      Listings?: OfferListing[];
    };
    Images?: {
      Primary?: {
        Medium?: ImageInfo;
        Large?: ImageInfo;
        Small?: ImageInfo;
      };
    };
  }

  interface SearchResult {
    Items?: SearchItem[];
    TotalResultCount?: number;
  }

  interface SearchItemsResponse {
    SearchResult?: SearchResult;
    Errors?: Array<{
      Code: string;
      Message: string;
    }>;
  }

  function SearchItems(
    commonParameters: CommonParameters,
    requestParameters: SearchItemsParameters
  ): Promise<SearchItemsResponse>;

  export default {
    SearchItems,
  };
}
