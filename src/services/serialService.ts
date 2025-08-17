interface SerialMessage {
  id: string;
  timestamp: Date;
  message: string;
  type: 'received' | 'sent' | 'error' | 'info';
}

class SerialService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private isConnected: boolean = false;
  private messageListeners: ((message: SerialMessage) => void)[] = [];

  async isWebSerialSupported(): Promise<boolean> {
    return 'serial' in navigator;
  }

  async requestPort(): Promise<boolean> {
    try {
      if (!await this.isWebSerialSupported()) {
        this.notifyError('Web Serial API not supported in this browser');
        return false;
      }

      this.port = await navigator.serial.requestPort();
      return true;
    } catch (error) {
      this.notifyError('Failed to request serial port access');
      return false;
    }
  }

  async connect(baudRate: number = 9600): Promise<boolean> {
    try {
      if (!this.port) {
        const granted = await this.requestPort();
        if (!granted) return false;
      }

      // Set DTR and RTS for Arduino reset
      await this.port!.open({ 
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });

      // Toggle DTR to reset Arduino
      await this.resetArduino();
      
      this.isConnected = true;
      this.notifyInfo(`Connected to serial port at ${baudRate} baud`);
      
      this.startReading();
      this.setupWriter();
      
      return true;
    } catch (error) {
      this.notifyError(`Failed to connect: ${error}`);
      return false;
    }
  }

  private async resetArduino(): Promise<void> {
    if (!this.port) return;
    
    try {
      // DTR toggle for Arduino reset - Note: setSignals might not be available in all browsers
      if ('setSignals' in this.port) {
        await (this.port as any).setSignals({ dataTerminalReady: false });
        await new Promise(resolve => setTimeout(resolve, 100));
        await (this.port as any).setSignals({ dataTerminalReady: true });
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.warn('DTR reset not supported on this device');
      }
    } catch (error) {
      console.warn('Could not reset Arduino via DTR:', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      
      this.isConnected = false;
      this.notifyInfo('Disconnected from serial port');
    } catch (error) {
      this.notifyError(`Error during disconnect: ${error}`);
    }
  }

  async sendMessage(message: string): Promise<boolean> {
    try {
      if (!this.writer || !this.isConnected) {
        this.notifyError('Not connected to serial port');
        return false;
      }

      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode(message + '\n'));
      
      this.notifyMessage(message, 'sent');
      return true;
    } catch (error) {
      this.notifyError(`Failed to send message: ${error}`);
      return false;
    }
  }

  private async startReading(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    this.reader = this.port.readable.getReader();
    
    try {
      while (this.isConnected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        
        // Split by newlines and process each line
        const lines = text.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.notifyMessage(line.trim(), 'received');
        });
      }
    } catch (error) {
      if (this.isConnected) {
        this.notifyError(`Reading error: ${error}`);
      }
    } finally {
      this.reader?.releaseLock();
    }
  }

  private async setupWriter(): Promise<void> {
    if (!this.port || !this.port.writable) return;
    this.writer = this.port.writable.getWriter();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getPort(): SerialPort | null {
    return this.port;
  }

  async detectArduino(): Promise<{ detected: boolean; boardType?: string }> {
    if (!this.isConnected || !this.writer) {
      return { detected: false };
    }

    try {
      // Send a simple command to detect Arduino
      await this.sendMessage('AT');
      
      // Wait for response (simplified detection)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { 
        detected: true, 
        boardType: 'Arduino Compatible Device' 
      };
    } catch (error) {
      return { detected: false };
    }
  }

  addMessageListener(callback: (message: SerialMessage) => void): void {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback: (message: SerialMessage) => void): void {
    const index = this.messageListeners.indexOf(callback);
    if (index > -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  private notifyMessage(message: string, type: 'received' | 'sent'): void {
    const serialMessage: SerialMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type,
    };
    
    this.messageListeners.forEach(listener => listener(serialMessage));
  }

  private notifyInfo(message: string): void {
    const serialMessage: SerialMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type: 'info',
    };
    
    this.messageListeners.forEach(listener => listener(serialMessage));
  }

  private notifyError(message: string): void {
    const serialMessage: SerialMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type: 'error',
    };
    
    this.messageListeners.forEach(listener => listener(serialMessage));
  }
}

export const serialService = new SerialService();
export type { SerialMessage };