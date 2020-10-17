export interface RedisMessage {
  hasError: boolean;
  data: Record<string, any>;
}
