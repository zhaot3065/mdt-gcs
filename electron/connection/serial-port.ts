import { EventEmitter } from 'node:events';
import { SerialPort } from 'serialport';
import type { SerialPortInfo } from '../../shared/types/datalink';
export interface SerialOptions {
  path: string;
  baudRate: number;
}

export class SerialTransport extends EventEmitter {
  private port: SerialPort | null = null;

  async connect(options: SerialOptions): Promise<void> {
    await this.disconnect();

    this.port = new SerialPort({
      path: options.path,
      baudRate: options.baudRate,
      autoOpen: false,
    });

    return new Promise((resolve, reject) => {
      if (!this.port) return reject(new Error('Serial port not created'));

      this.port.on('data', (chunk: Buffer) => this.emit('data', chunk));
      this.port.on('error', (err) => this.emit('error', err));
      this.port.on('close', () => {
        this.port = null;
        this.emit('disconnected');
      });

      this.port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.emit('connected');
        resolve();
      });
    });
  }

  send(data: Buffer): void {
    this.port?.write(data);
  }

  async disconnect(): Promise<void> {
    if (!this.port) return;
    const port = this.port;
    this.port = null;
    await new Promise<void>((resolve) => {
      port.close(() => resolve());
    });
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.port?.isOpen ?? false;
  }

  static async listPorts(): Promise<SerialPortInfo[]> {
    const ports = await SerialPort.list();
    return ports
      .filter((p) => p.path)
      .map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer ?? undefined,
        serialNumber: p.serialNumber ?? undefined,
        vendorId: p.vendorId ?? undefined,
        productId: p.productId ?? undefined,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
}
