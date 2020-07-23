export interface RedisMessage {
  hasError: boolean;
  data: Record<string, any>;
  campaignId: string;
  campaignRoll20Ids: string[];
}
