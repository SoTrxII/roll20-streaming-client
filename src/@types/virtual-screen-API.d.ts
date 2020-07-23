export interface VirtualScreenAPI {
  startVirtualScreen(): Promise<number>;
  stopVirtualScreen(): void;
}
