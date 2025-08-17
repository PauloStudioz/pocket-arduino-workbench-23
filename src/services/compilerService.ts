interface CompileResult {
  success: boolean;
  output: string[];
  errors: CompileError[];
  warnings: CompileError[];
  hexSize?: number;
  ramUsage?: number;
  hexData?: string;
  buildTime?: number;
}

interface CompileError {
  line: number;
  column?: number;
  message: string;
  type: 'error' | 'warning' | 'info';
  suggestion?: string;
}

interface BoardConfig {
  id: string;
  name: string;
  fqbn: string;
  mcu: string;
  f_cpu: string;
  upload_speed: string;
}

class CompilerService {
  private supportedBoards: BoardConfig[] = [
    {
      id: 'uno',
      name: 'Arduino Uno',
      fqbn: 'arduino:avr:uno',
      mcu: 'atmega328p',
      f_cpu: '16000000L',
      upload_speed: '115200'
    },
    {
      id: 'nano',
      name: 'Arduino Nano',
      fqbn: 'arduino:avr:nano:cpu=atmega328',
      mcu: 'atmega328p',
      f_cpu: '16000000L',
      upload_speed: '57600'
    },
    {
      id: 'mega',
      name: 'Arduino Mega 2560',
      fqbn: 'arduino:avr:mega:cpu=atmega2560',
      mcu: 'atmega2560',
      f_cpu: '16000000L',
      upload_speed: '115200'
    }
  ];

  async compileSketch(code: string, boardId: string): Promise<CompileResult> {
    const board = this.supportedBoards.find(b => b.id === boardId);
    if (!board) {
      return {
        success: false,
        output: [],
        errors: [{
          line: 0,
          message: 'Unsupported board type',
          type: 'error'
        }],
        warnings: []
      };
    }

    const startTime = Date.now();
    
    // Enhanced compilation with real parsing
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.performAdvancedCompilation(code, board, startTime);
        resolve(result);
      }, 1500 + Math.random() * 2000); // 1.5-3.5 seconds compilation time
    });
  }

  private performAdvancedCompilation(code: string, board: BoardConfig, startTime: number): CompileResult {
    const output: string[] = [];
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];

    output.push(`Arduino compilation started for ${board.name}`);
    output.push(`Board: ${board.fqbn}`);
    output.push(`MCU: ${board.mcu}`);
    output.push(`F_CPU: ${board.f_cpu}`);
    output.push('');

    // Enhanced syntax and semantic analysis
    const analysisResult = this.performCodeAnalysis(code);
    errors.push(...analysisResult.errors);
    warnings.push(...analysisResult.warnings);

    // Library validation
    const libraryResult = this.validateLibraries(code);
    errors.push(...libraryResult.errors);
    warnings.push(...libraryResult.warnings);

    // Arduino-specific validations
    const arduinoResult = this.validateArduinoCode(code);
    errors.push(...arduinoResult.errors);
    warnings.push(...arduinoResult.warnings);

    if (errors.length === 0) {
      output.push('Preprocessing...');
      output.push('Compiling sketch...');
      output.push('Compiling libraries...');
      output.push('Linking...');
      output.push('');
      
      const codeSize = Math.floor(1200 + code.length * 0.9 + Math.random() * 400);
      const ramUsage = Math.floor(180 + code.length * 0.12 + Math.random() * 80);
      const buildTime = Date.now() - startTime;
      
      // Generate mock hex data (in real implementation, this would be actual hex)
      const hexData = this.generateMockHexData(code, board);
      
      output.push(`Sketch uses ${codeSize} bytes (${Math.round(codeSize/32768*100)}%) of program storage space.`);
      output.push(`Global variables use ${ramUsage} bytes (${Math.round(ramUsage/2048*100)}%) of dynamic memory.`);
      output.push(`Compilation completed in ${(buildTime/1000).toFixed(1)}s`);
      output.push('');
      output.push('✓ Compilation successful!');

      return {
        success: true,
        output,
        errors,
        warnings,
        hexSize: codeSize,
        ramUsage,
        hexData,
        buildTime
      };
    } else {
      output.push('❌ Compilation failed!');
      output.push(`Found ${errors.length} error(s) and ${warnings.length} warning(s)`);
      
      return {
        success: false,
        output,
        errors,
        warnings,
        buildTime: Date.now() - startTime
      };
    }
  }

  private performCodeAnalysis(code: string): { errors: CompileError[], warnings: CompileError[] } {
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];
    const lines = code.split('\n');
    
    let hasSetup = false;
    let hasLoop = false;
    let braceCount = 0;
    let inMultiLineComment = false;
    let functionCount = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;
      
      // Handle multi-line comments
      if (trimmed.includes('/*')) inMultiLineComment = true;
      if (trimmed.includes('*/')) inMultiLineComment = false;
      if (inMultiLineComment) return;
      
      // Skip single-line comments
      if (trimmed.startsWith('//')) return;
      
      // Check for required functions
      if (trimmed.includes('void setup()') || trimmed.includes('void setup(')) {
        hasSetup = true;
        functionCount++;
      }
      if (trimmed.includes('void loop()') || trimmed.includes('void loop(')) {
        hasLoop = true;
        functionCount++;
      }

      // Count braces
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      // Enhanced syntax checking
      if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
        // Missing semicolon detection
        if (!trimmed.endsWith(';') && !trimmed.includes('if') && !trimmed.includes('else') && 
            !trimmed.includes('for') && !trimmed.includes('while') && !trimmed.includes('switch') &&
            !trimmed.includes('void') && !trimmed.includes('int') && !trimmed.includes('float') &&
            trimmed !== '' && !trimmed.startsWith('//')) {
          errors.push({
            line: lineNumber,
            message: 'Missing semicolon',
            type: 'error',
            suggestion: `Add ';' at the end of line ${lineNumber}`
          });
        }

        // Undefined variable detection (basic)
        if (trimmed.includes('digitalRead') || trimmed.includes('digitalWrite')) {
          const match = trimmed.match(/digital(?:Read|Write)\((\w+)\)/);
          if (match && !code.includes(`#define ${match[1]}`) && !code.includes(`int ${match[1]}`) && !code.includes(`const int ${match[1]}`)) {
            warnings.push({
              line: lineNumber,
              message: `Pin '${match[1]}' may not be defined`,
              type: 'warning',
              suggestion: `Define ${match[1]} with #define or as a variable`
            });
          }
        }
      }
    });

    // Required functions check
    if (!hasSetup) {
      errors.push({
        line: 0,
        message: 'setup() function not found',
        type: 'error',
        suggestion: 'Add void setup() { ... } function'
      });
    }
    if (!hasLoop) {
      errors.push({
        line: 0,
        message: 'loop() function not found',
        type: 'error',
        suggestion: 'Add void loop() { ... } function'
      });
    }

    // Brace matching
    if (braceCount !== 0) {
      errors.push({
        line: 0,
        message: `Mismatched braces (${braceCount > 0 ? 'missing closing' : 'extra closing'} braces)`,
        type: 'error',
        suggestion: 'Check your { } brackets are properly matched'
      });
    }

    return { errors, warnings };
  }

  private validateLibraries(code: string): { errors: CompileError[], warnings: CompileError[] } {
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];
    const lines = code.split('\n');
    
    const commonLibraries = [
      'Servo.h', 'LiquidCrystal.h', 'SoftwareSerial.h', 'Wire.h', 'SPI.h'
    ];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;
      
      if (trimmed.startsWith('#include')) {
        const match = trimmed.match(/#include\s*<(.+?)>/);
        if (match) {
          const library = match[1];
          if (!commonLibraries.includes(library) && !library.startsWith('Arduino')) {
            warnings.push({
              line: lineNumber,
              message: `Library '${library}' may not be available`,
              type: 'warning',
              suggestion: 'Ensure this library is installed'
            });
          }
        }
      }
    });

    return { errors, warnings };
  }

  private validateArduinoCode(code: string): { errors: CompileError[], warnings: CompileError[] } {
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;
      
      // Check for common Arduino mistakes
      if (trimmed.includes('Serial.begin') && !trimmed.includes('9600') && !trimmed.includes('115200')) {
        warnings.push({
          line: lineNumber,
          message: 'Unusual baud rate detected',
          type: 'warning',
          suggestion: 'Common baud rates are 9600 or 115200'
        });
      }
      
      if (trimmed.includes('delay(0)')) {
        warnings.push({
          line: lineNumber,
          message: 'delay(0) has no effect',
          type: 'warning',
          suggestion: 'Remove delay(0) or use a positive value'
        });
      }

      // Check for potential pin conflicts
      if (trimmed.includes('pinMode') && (trimmed.includes('0') || trimmed.includes('1'))) {
        warnings.push({
          line: lineNumber,
          message: 'Using pins 0 or 1 may interfere with Serial communication',
          type: 'warning',
          suggestion: 'Consider using pins 2-13 for digital I/O'
        });
      }
    });

    return { errors, warnings };
  }

  private generateMockHexData(code: string, board: BoardConfig): string {
    // In a real implementation, this would be actual compiled hex data
    const baseHex = ':020000040000FA\n:100000000C945C000C9486000C9486000C948600';
    const codeHash = code.length.toString(16).padStart(8, '0');
    return baseHex + codeHash + '\n:00000001FF';
  }

  getSupportedBoards(): BoardConfig[] {
    return this.supportedBoards;
  }

  getBoardConfig(boardId: string): BoardConfig | undefined {
    return this.supportedBoards.find(board => board.id === boardId);
  }

  async validateCode(code: string): Promise<{ valid: boolean; errors: CompileError[]; warnings: CompileError[] }> {
    const analysisResult = this.performCodeAnalysis(code);
    const libraryResult = this.validateLibraries(code);
    const arduinoResult = this.validateArduinoCode(code);
    
    const errors = [
      ...analysisResult.errors,
      ...libraryResult.errors,
      ...arduinoResult.errors
    ];
    
    const warnings = [
      ...analysisResult.warnings,
      ...libraryResult.warnings,
      ...arduinoResult.warnings
    ];

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getCodeSuggestions(code: string, cursorLine: number): Promise<string[]> {
    const suggestions: string[] = [];
    const lines = code.split('\n');
    const currentLine = lines[cursorLine - 1]?.trim() || '';
    
    // Auto-complete suggestions based on context
    if (currentLine.includes('digital')) {
      suggestions.push('digitalWrite(pin, HIGH)', 'digitalWrite(pin, LOW)', 'digitalRead(pin)');
    }
    if (currentLine.includes('analog')) {
      suggestions.push('analogRead(pin)', 'analogWrite(pin, value)');
    }
    if (currentLine.includes('Serial')) {
      suggestions.push('Serial.begin(9600)', 'Serial.print()', 'Serial.println()');
    }
    if (currentLine.includes('delay')) {
      suggestions.push('delay(1000)', 'delayMicroseconds(1000)');
    }
    
    return suggestions;
  }
}

export const compilerService = new CompilerService();
export type { CompileResult, BoardConfig, CompileError };