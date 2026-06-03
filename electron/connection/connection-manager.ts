import { BrowserWindow } from 'electron';

import type {
  DatalinkId,
  DatalinkIpcPayload,
  DatalinkSnapshot,
  EthernetConnectOptions,
  GcsCommandRequest,
  GcsCommandResult,
  SerialConnectOptions,
  TransportKind,
} from '../../shared/types/datalink';

import { IPC_CHANNELS } from '../../shared/types/datalink';

import { MavlinkStreamStats } from './mavlink-stats';

import { computeLinkQuality } from './link-quality';

import { MavlinkRouter, buildLinkHealth } from './mavlink-router';

import { UdpTransport } from './udp-socket';

import { TcpClientTransport } from './tcp-socket';

import { SerialTransport } from './serial-port';
import { sendCommandOnActiveLink } from './command-egress';



type ActiveTransport = UdpTransport | TcpClientTransport | SerialTransport;



interface LinkRuntime {

  id: DatalinkId;

  label: string;

  state: DatalinkSnapshot['state'];

  transport?: TransportKind;

  endpoint?: string;

  stats: MavlinkStreamStats;

  active?: ActiveTransport;

}



const METRICS_INTERVAL_MS = 200;



export class ConnectionManager {

  private router = new MavlinkRouter();



  private links = new Map<DatalinkId, LinkRuntime>([

    [

      'ethernet',

      {

        id: 'ethernet',

        label: 'SprintLink (Ethernet)',

        state: 'disconnected',

        stats: new MavlinkStreamStats(),

      },

    ],

    [

      'h16_rf',

      {

        id: 'h16_rf',

        label: 'H16 RF',

        state: 'disconnected',

        stats: new MavlinkStreamStats(),

      },

    ],

  ]);



  private metricsTimer: NodeJS.Timeout | null = null;



  startMetricsBroadcast(getWindow: () => BrowserWindow | null): void {

    if (this.metricsTimer) return;

    this.metricsTimer = setInterval(() => {

      const win = getWindow();

      if (!win || win.isDestroyed()) return;

      win.webContents.send(IPC_CHANNELS.DATALINK_SNAPSHOT, this.buildPayload());

    }, METRICS_INTERVAL_MS);

  }



  stopMetricsBroadcast(): void {

    if (this.metricsTimer) {

      clearInterval(this.metricsTimer);

      this.metricsTimer = null;

    }

  }



  getPayload(): DatalinkIpcPayload {

    return this.buildPayload();

  }



  /** @deprecated use getPayload */

  getSnapshot(): DatalinkSnapshot[] {

    return this.buildPayload().links;

  }



  getRouter(): MavlinkRouter {

    return this.router;

  }



  async connectEthernet(options: EthernetConnectOptions): Promise<void> {

    const link = this.links.get('ethernet')!;

    await this.teardownLink(link);



    link.state = 'connecting';

    let transport: ActiveTransport;

    let endpoint: string;

    let kind: TransportKind;



    if (options.mode === 'tcp-client') {

      const tcp = new TcpClientTransport();

      kind = 'tcp-client';

      endpoint = `${options.host}:${options.port}`;

      transport = tcp;

      this.wireTransport(link, tcp, kind, endpoint);

      await tcp.connect({ host: options.host, port: options.port });

    } else {

      const udp = new UdpTransport();

      kind = options.mode === 'udp-server' ? 'udp-server' : 'udp-client';

      endpoint =

        options.mode === 'udp-server'

          ? `UDP listen :${options.port}`

          : `UDP ${options.host}:${options.port}`;

      transport = udp;

      this.wireTransport(link, udp, kind, endpoint);

      await udp.connect({

        mode: options.mode === 'udp-server' ? 'server' : 'client',

        host: options.host,

        port: options.port,

        localHost: options.localHost,

        localPort: options.localPort,

      });

    }



    link.active = transport;

    link.state = 'connected';

  }



  async disconnectEthernet(): Promise<void> {

    const link = this.links.get('ethernet')!;

    await this.teardownLink(link);

    link.state = 'disconnected';

    link.stats.reset();

  }



  async connectH16(options: SerialConnectOptions): Promise<void> {

    const link = this.links.get('h16_rf')!;

    await this.teardownLink(link);



    link.state = 'connecting';

    const serial = new SerialTransport();

    const endpoint = `${options.path} @ ${options.baudRate}`;

    this.wireTransport(link, serial, 'serial', endpoint);

    await serial.connect(options);

    link.active = serial;

    link.state = 'connected';

  }



  async disconnectH16(): Promise<void> {

    const link = this.links.get('h16_rf')!;

    await this.teardownLink(link);

    link.state = 'disconnected';

    link.stats.reset();

  }



  async listSerialPorts() {
    return SerialTransport.listPorts();
  }

  /**
   * Egress: send MAVLink COMMAND_LONG only on MavlinkRouter active link.
   */
  sendGcsCommand(request: GcsCommandRequest): GcsCommandResult {
    return sendCommandOnActiveLink(
      {
        router: this.router,
        getLinks: () => this.buildPayload().links,
        getTransport: (id) => this.links.get(id)?.active,
      },
      request,
    );
  }

  private wireTransport(

    link: LinkRuntime,

    transport: ActiveTransport,

    kind: TransportKind,

    endpoint: string,

  ): void {

    link.transport = kind;

    link.endpoint = endpoint;



    transport.on('data', (chunk: Buffer) => {

      link.stats.ingest(chunk);

      this.router.ingest(link.id, chunk);

    });



    transport.on('error', () => {

      link.state = 'error';

    });



    transport.on('disconnected', () => {

      if (link.state === 'connected') link.state = 'disconnected';

    });

  }



  private async teardownLink(link: LinkRuntime): Promise<void> {

    if (link.active) {

      await link.active.disconnect();

      link.active.removeAllListeners();

      link.active = undefined;

    }

    link.transport = undefined;

    link.endpoint = undefined;

  }



  private buildBaseSnapshots(now: number): Omit<DatalinkSnapshot, 'health'>[] {

    return [...this.links.values()].map((link) => {

      const raw = link.stats.snapshot(now);

      const metrics = {

        packetsReceived: raw.packetsReceived,

        packetsLost: raw.packetsLost,

        lossRatePercent: raw.lossRatePercent,

        latencyMs: raw.latencyMs,

        lastPacketAgeMs: raw.lastPacketAgeMs,

        bytesReceived: raw.bytesReceived,

        updatedAt: now,

      };

      const quality = computeLinkQuality(link.state, metrics);

      return {

        id: link.id,

        label: link.label,

        state: link.state,

        quality,

        transport: link.transport,

        endpoint: link.endpoint,

        metrics,

      };

    });

  }



  private buildPayload(): DatalinkIpcPayload {

    const now = Date.now();

    const base = this.buildBaseSnapshots(now);

    const routerPreview = this.router.getSnapshot(

      base.map((b) => ({

        ...b,

        health: buildLinkHealth(b, null),

      })),

    );

    const links: DatalinkSnapshot[] = base.map((b) => ({

      ...b,

      health: buildLinkHealth(b, routerPreview.activeLinkId),

    }));

    const router = this.router.getSnapshot(links);



    return { links, router, updatedAt: now };

  }

}


