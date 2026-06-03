import dgram, { type Socket, type RemoteInfo } from 'node:dgram';
import { EventEmitter } from 'node:events';

export type UdpMode = 'client' | 'server';

export interface UdpOptions {
  mode: UdpMode;
  /** Remote host for client mode (send + optional filter) */
  host?: string;
  port: number;
  localHost?: string;
  localPort?: number;
}

export class UdpTransport extends EventEmitter {
  private socket: Socket | null = null;
  private mode: UdpMode = 'client';
  private remoteHost?: string;
  private remotePort = 14550;

  async connect(options: UdpOptions): Promise<void> {
    await this.disconnect();
    this.mode = options.mode;
    this.remoteHost = options.host;
    this.remotePort = options.port;

    this.socket = dgram.createSocket('udp4');

    await new Promise<void>((resolve, reject) => {
      if (!this.socket) return reject(new Error('UDP socket not created'));

      this.socket.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
        if (this.mode === 'client' && this.remoteHost && rinfo.address !== this.remoteHost) {
          // Allow first remote to teach address if host was broadcast
        }
        this.emit('data', msg);
      });

      const bindHost = options.localHost ?? '0.0.0.0';
      const bindPort = options.localPort ?? (options.mode === 'server' ? options.port : 0);

      this.socket.bind(bindPort, bindHost, () => {
        if (options.mode === 'client' && options.host) {
          this.socket?.connect(options.port, options.host, () => resolve());
        } else {
          resolve();
        }
      });
    });

    this.emit('connected');
  }

  send(data: Buffer): void {
    if (!this.socket) return;
    if (this.mode === 'client' && this.remoteHost) {
      this.socket.send(data, this.remotePort, this.remoteHost);
    } else {
      // server: need last remote — simplified: broadcast not implemented in scaffold
      this.socket.send(data, this.remotePort, this.remoteHost ?? '127.0.0.1');
    }
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return;
    const sock = this.socket;
    this.socket = null;
    await new Promise<void>((resolve) => {
      sock.close(() => resolve());
    });
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.socket !== null;
  }
}
