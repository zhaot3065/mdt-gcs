import net, { type Socket } from 'node:net';
import { EventEmitter } from 'node:events';

export interface TcpClientOptions {
  host: string;
  port: number;
}

export class TcpClientTransport extends EventEmitter {
  private socket: Socket | null = null;

  async connect(options: TcpClientOptions): Promise<void> {
    await this.disconnect();

    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: options.host, port: options.port }, () => {
        this.socket = sock;
        this.emit('connected');
        resolve();
      });

      sock.on('data', (chunk: Buffer) => this.emit('data', chunk));
      sock.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });
      sock.on('close', () => {
        this.socket = null;
        this.emit('disconnected');
      });
    });
  }

  send(data: Buffer): void {
    this.socket?.write(data);
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return;
    const sock = this.socket;
    this.socket = null;
    await new Promise<void>((resolve) => sock.end(() => resolve()));
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }
}
