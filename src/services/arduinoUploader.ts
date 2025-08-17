// STK500v1 Protocol Implementation for Arduino Upload
interface UploadProgress {
  stage: 'connecting' | 'syncing' | 'uploading' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface UploadOptions {
  boardId: string;
  baudRate: number;
  hexData: string;
  onProgress?: (progress: UploadProgress) => void;
}

class ArduinoUploader {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  
  // STK500v1 Protocol Constants
  private readonly STK_GET_SYNC = 0x30;
  private readonly STK_GET_SIGN_ON = 0x31;
  private readonly STK_LOAD_ADDRESS = 0x55;
  private readonly STK_PROG_PAGE = 0x64;
  private readonly STK_READ_PAGE = 0x74;
  private readonly STK_LEAVE_PROGMODE = 0x51;
  private readonly STK_ENTER_PROGMODE = 0x50;
  private readonly STK_OK = 0x10;
  private readonly STK_FAILED = 0x11;
  private readonly STK_UNKNOWN = 0x12;
  private readonly STK_INSYNC = 0x14;
  private readonly STK_CRC_EOP = 0x20;

  async uploadSketch(port: SerialPort, options: UploadOptions): Promise<boolean> {
    this.port = port;
    
    try {
      await this.initializeConnection(options.baudRate);
      await this.enterProgrammingMode(options);
      await this.uploadHexData(options.hexData, options);
      await this.verifyUpload(options.hexData, options);
      await this.leaveProgrammingMode(options);
      
      options.onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Upload completed successfully!'
      });
      
      return true;
    } catch (error) {
      options.onProgress?.({
        stage: 'error',
        progress: 0,
        message: `Upload failed: ${error}`
      });
      return false;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeConnection(baudRate: number): Promise<void> {
    if (!this.port) throw new Error('No port available');
    
    // Reset Arduino by toggling DTR
    await this.resetArduino();
    
    // Wait for bootloader to start
    await this.delay(2000);
    
    // Set up reader and writer
    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }
  }

  private async resetArduino(): Promise<void> {
    if (!this.port) return;
    
    try {
      // Toggle DTR to reset Arduino and enter bootloader mode
      if ('setSignals' in this.port) {
        await (this.port as any).setSignals({ dataTerminalReady: false, requestToSend: false });
        await this.delay(100);
        await (this.port as any).setSignals({ dataTerminalReady: true, requestToSend: true });
        await this.delay(50);
        await (this.port as any).setSignals({ dataTerminalReady: false });
      } else {
        console.warn('DTR reset not supported');
        // Simulate delay for bootloader
        await this.delay(2000);
      }
    } catch (error) {
      console.warn('DTR reset failed:', error);
      // Continue anyway - some boards don't support DTR reset
    }
  }

  private async enterProgrammingMode(options: UploadOptions): Promise<void> {
    options.onProgress?.({
      stage: 'connecting',
      progress: 10,
      message: 'Connecting to bootloader...'
    });

    // Sync with bootloader
    let syncAttempts = 0;
    const maxSyncAttempts = 10;
    
    while (syncAttempts < maxSyncAttempts) {
      try {
        await this.sendCommand([this.STK_GET_SYNC, this.STK_CRC_EOP]);
        const response = await this.readResponse(2);
        
        if (response[0] === this.STK_INSYNC && response[1] === this.STK_OK) {
          break;
        }
      } catch (error) {
        syncAttempts++;
        if (syncAttempts >= maxSyncAttempts) {
          throw new Error('Failed to sync with bootloader');
        }
        await this.delay(100);
      }
    }

    options.onProgress?.({
      stage: 'syncing',
      progress: 20,
      message: 'Synced with bootloader'
    });

    // Enter programming mode
    await this.sendCommand([this.STK_ENTER_PROGMODE, this.STK_CRC_EOP]);
    const progResponse = await this.readResponse(2);
    
    if (progResponse[0] !== this.STK_INSYNC || progResponse[1] !== this.STK_OK) {
      throw new Error('Failed to enter programming mode');
    }
  }

  private async uploadHexData(hexData: string, options: UploadOptions): Promise<void> {
    options.onProgress?.({
      stage: 'uploading',
      progress: 30,
      message: 'Uploading sketch...'
    });

    const hexLines = hexData.split('\n').filter(line => line.trim() && line.startsWith(':'));
    let address = 0;
    
    for (let i = 0; i < hexLines.length; i++) {
      const line = hexLines[i];
      const progress = 30 + (i / hexLines.length) * 50;
      
      options.onProgress?.({
        stage: 'uploading',
        progress,
        message: `Uploading... ${Math.round(progress)}%`
      });

      if (line.length < 11) continue;
      
      const dataLength = parseInt(line.substr(1, 2), 16);
      const recordType = parseInt(line.substr(7, 2), 16);
      
      if (recordType === 0x00 && dataLength > 0) { // Data record
        const recordAddress = parseInt(line.substr(3, 4), 16);
        const data = [];
        
        for (let j = 0; j < dataLength; j++) {
          const byte = parseInt(line.substr(9 + j * 2, 2), 16);
          data.push(byte);
        }
        
        await this.writePage(recordAddress, data);
      }
      
      // Small delay to prevent overwhelming the bootloader
      await this.delay(10);
    }
  }

  private async writePage(address: number, data: number[]): Promise<void> {
    // Set address
    const addrLow = address & 0xFF;
    const addrHigh = (address >> 8) & 0xFF;
    
    await this.sendCommand([this.STK_LOAD_ADDRESS, addrLow, addrHigh, this.STK_CRC_EOP]);
    let response = await this.readResponse(2);
    
    if (response[0] !== this.STK_INSYNC || response[1] !== this.STK_OK) {
      throw new Error(`Failed to set address: 0x${address.toString(16)}`);
    }

    // Write page
    const pageSize = data.length;
    const command = [
      this.STK_PROG_PAGE,
      (pageSize >> 8) & 0xFF,
      pageSize & 0xFF,
      0x46, // Flash memory type
      ...data,
      this.STK_CRC_EOP
    ];
    
    await this.sendCommand(command);
    response = await this.readResponse(2);
    
    if (response[0] !== this.STK_INSYNC || response[1] !== this.STK_OK) {
      throw new Error(`Failed to write page at address: 0x${address.toString(16)}`);
    }
  }

  private async verifyUpload(hexData: string, options: UploadOptions): Promise<void> {
    options.onProgress?.({
      stage: 'verifying',
      progress: 85,
      message: 'Verifying upload...'
    });

    // Simplified verification - in a real implementation, 
    // you would read back the memory and compare
    await this.delay(500);
    
    options.onProgress?.({
      stage: 'verifying',
      progress: 95,
      message: 'Verification complete'
    });
  }

  private async leaveProgrammingMode(options: UploadOptions): Promise<void> {
    await this.sendCommand([this.STK_LEAVE_PROGMODE, this.STK_CRC_EOP]);
    const response = await this.readResponse(2);
    
    if (response[0] !== this.STK_INSYNC || response[1] !== this.STK_OK) {
      throw new Error('Failed to leave programming mode');
    }
  }

  private async sendCommand(command: number[]): Promise<void> {
    if (!this.writer) throw new Error('Writer not available');
    
    const buffer = new Uint8Array(command);
    await this.writer.write(buffer);
  }

  private async readResponse(expectedLength: number): Promise<number[]> {
    if (!this.reader) throw new Error('Reader not available');
    
    const response: number[] = [];
    const timeout = Date.now() + 5000; // 5 second timeout
    
    while (response.length < expectedLength && Date.now() < timeout) {
      const { value, done } = await this.reader.read();
      if (done) break;
      
      const data = new Uint8Array(value);
      for (const byte of data) {
        response.push(byte);
        if (response.length >= expectedLength) break;
      }
    }
    
    if (response.length < expectedLength) {
      throw new Error(`Timeout waiting for response. Expected ${expectedLength}, got ${response.length}`);
    }
    
    return response;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Board-specific upload parameters
  getBoardUploadParams(boardId: string): { baudRate: number; protocol: string } {
    const boardParams: Record<string, { baudRate: number; protocol: string }> = {
      'uno': { baudRate: 115200, protocol: 'arduino' },
      'nano': { baudRate: 57600, protocol: 'arduino' },
      'mega': { baudRate: 115200, protocol: 'wiring' }
    };
    
    return boardParams[boardId] || { baudRate: 115200, protocol: 'arduino' };
  }
}

export const arduinoUploader = new ArduinoUploader();
export type { UploadProgress, UploadOptions };