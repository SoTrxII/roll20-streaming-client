import EventEmitter = NodeJS.EventEmitter;

export interface RedisAPI extends EventEmitter {
  publish(channel: string, payload: Record<string, any>);

  subscribe(channel: string);
}
