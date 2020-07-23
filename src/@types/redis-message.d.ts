export interface RedisMessage {
  hasError: boolean;
  data: Record<string, any>;
  campaignId: string;
  campaignRoll2OIds: string[];
}
