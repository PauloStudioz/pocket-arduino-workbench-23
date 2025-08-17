
import { compilerService, CompileResult, CompileError } from './compilerService';

interface CompilerCache {
  [codeHash: string]: {
    result: CompileResult;
    timestamp: number;
  };
}

class EnhancedCompiler {
  private cache: CompilerCache = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async compileWithCache(code: string, boardId: string): Promise<CompileResult> {
    const codeHash = this.hashCode(code + boardId);
    const cached = this.cache[codeHash];
    
    // Return cached result if valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result;
    }

    // Compile and cache result
    const result = await compilerService.compileSketch(code, boardId);
    this.cache[codeHash] = {
      result,
      timestamp: Date.now()
    };

    return result;
  }

  async validateSyntax(code: string): Promise<{ errors: CompileError[]; warnings: CompileError[] }> {
    const lines = code.split('\n');
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];
    
    let braceDepth = 0;
    let parenDepth = 0;
    let hasSetup = false;
    let hasLoop = false;
    let inMultiLineComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNumber = i + 1;

      // Handle multi-line comments
      if (trimmed.includes('/*')) inMultiLineComment = true;
      if (trimmed.includes('*/')) inMultiLineComment = false;
      if (inMultiLineComment || trimmed.startsWith('//')) continue;

      // Check for required functions
      if (trimmed.match(/void\s+setup\s*\(/)) hasSetup = true;
      if (trimmed.match(/void\s+loop\s*\(/)) hasLoop = true;

      // Track braces and parentheses
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      parenDepth += (line.match(/\(/g) || []).length;
      parenDepth -= (line.match(/\)/g) || []).length;

      // Check for common syntax errors
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
        // Missing semicolon check
        if (this.shouldHaveSemicolon(trimmed) && !trimmed.endsWith(';')) {
          errors.push({
            line: lineNumber,
            column: line.length,
            message: 'Missing semicolon',
            type: 'error'
          });
        }

        // Undefined pin warnings
        this.checkPinDefinitions(line, lineNumber, code, warnings);
      }
    }

    // Check for required functions
    if (!hasSetup) {
      errors.push({
        line: 1,
        message: 'setup() function is required',
        type: 'error'
      });
    }

    if (!hasLoop) {
      errors.push({
        line: 1,
        message: 'loop() function is required',
        type: 'error'
      });
    }

    // Check brace matching
    if (braceDepth !== 0) {
      errors.push({
        line: lines.length,
        message: `Unmatched braces (${braceDepth > 0 ? 'missing }' : 'extra }'})`,
        type: 'error'
      });
    }

    return { errors, warnings };
  }

  private shouldHaveSemicolon(line: string): boolean {
    // Lines that should end with semicolon
    const patterns = [
      /\w+\s*=/, // assignments
      /digitalWrite\s*\(/, // digitalWrite calls
      /pinMode\s*\(/, // pinMode calls
      /Serial\.\w+\s*\(/, // Serial calls
      /delay\s*\(/, // delay calls
      /return\b/ // return statements
    ];

    return patterns.some(pattern => pattern.test(line)) && 
           !line.includes('{') && 
           !line.includes('}') &&
           !line.trim().startsWith('if') &&
           !line.trim().startsWith('for') &&
           !line.trim().startsWith('while');
  }

  private checkPinDefinitions(line: string, lineNumber: number, fullCode: string, warnings: CompileError[]) {
    const pinUsageRegex = /(digitalWrite|digitalRead|analogRead|analogWrite|pinMode)\s*\(\s*(\w+)/g;
    let match;

    while ((match = pinUsageRegex.exec(line)) !== null) {
      const pinName = match[2];
      
      // Check if pin is defined
      if (!this.isPinDefined(pinName, fullCode)) {
        warnings.push({
          line: lineNumber,
          column: match.index,
          message: `Pin '${pinName}' may not be defined`,
          type: 'warning'
        });
      }
    }
  }

  private isPinDefined(pinName: string, code: string): boolean {
    // Check for common Arduino pin definitions
    const commonPins = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'LED_BUILTIN'];
    
    if (commonPins.includes(pinName)) return true;
    
    // Check for #define or variable declarations
    const defineRegex = new RegExp(`#define\\s+${pinName}\\s+\\d+`);
    const varRegex = new RegExp(`(int|const\\s+int)\\s+${pinName}\\s*=`);
    
    return defineRegex.test(code) || varRegex.test(code);
  }

  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  clearCache() {
    this.cache = {};
  }

  getCacheStats() {
    const entries = Object.keys(this.cache).length;
    const validEntries = Object.values(this.cache).filter(
      entry => Date.now() - entry.timestamp < this.CACHE_DURATION
    ).length;
    
    return { total: entries, valid: validEntries };
  }
}

export const enhancedCompiler = new EnhancedCompiler();
