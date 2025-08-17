// Real-time compiler service with Monaco integration
import { loader } from '@monaco-editor/react';
import { compilerService, CompileResult, CompileError as ServiceCompileError } from './compilerService';

// Get monaco instance
const getMonaco = () => loader.__getMonacoInstance();

export interface CompilerError {
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
}

class RealTimeCompiler {
  private editor: any = null;
  private compileTimeout: NodeJS.Timeout | null = null;
  private markers: any[] = [];
  private lastCompileTime = 0;
  private readonly COMPILE_DELAY = 1000; // 1 second delay for real-time compilation

  setEditor(codeEditor: any) {
    this.editor = codeEditor;
    this.setupRealTimeCompilation();
  }

  private setupRealTimeCompilation() {
    if (!this.editor) return;

    // Listen for content changes
    this.editor.onDidChangeModelContent(() => {
      this.scheduleCompilation();
    });
  }

  private scheduleCompilation() {
    if (this.compileTimeout) {
      clearTimeout(this.compileTimeout);
    }

    this.compileTimeout = setTimeout(() => {
      this.performRealTimeCompilation();
    }, this.COMPILE_DELAY);
  }

  private async performRealTimeCompilation() {
    if (!this.editor) return;

    const code = this.editor.getValue();
    const now = Date.now();
    
    // Prevent too frequent compilations
    if (now - this.lastCompileTime < 500) return;
    this.lastCompileTime = now;

    try {
      // Perform lightweight syntax checking
      const errors = this.performSyntaxCheck(code);
      this.updateMarkers(errors);
      
      // For full compilation, we'll use a longer delay
      if (code.trim().length > 0) {
        setTimeout(() => this.performFullCompilation(code), 3000);
      }
    } catch (error) {
      console.warn('Real-time compilation error:', error);
    }
  }

  private performSyntaxCheck(code: string): CompilerError[] {
    const errors: CompilerError[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Basic syntax checks
      if (trimmedLine && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) {
        // Check for missing semicolons (simplified)
        if (this.shouldHaveSemicolon(trimmedLine) && !trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}')) {
          errors.push({
            line: lineNumber,
            column: line.length,
            severity: 'error',
            message: 'Missing semicolon',
            code: 'missing-semicolon'
          });
        }

        // Check for unmatched braces (simplified)
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        if (openBraces !== closeBraces && (openBraces > 0 || closeBraces > 0)) {
          // This is a very basic check - in a real implementation, you'd need proper parsing
        }

        // Check for undefined variables (basic Arduino functions)
        const undefinedFunctions = this.checkUndefinedFunctions(line);
        undefinedFunctions.forEach(func => {
          errors.push({
            line: lineNumber,
            column: line.indexOf(func.name),
            severity: 'error',
            message: `'${func.name}' was not declared in this scope`,
            code: 'undeclared-identifier'
          });
        });

        // Check for common Arduino mistakes
        const commonMistakes = this.checkCommonMistakes(line);
        commonMistakes.forEach(mistake => {
          errors.push({
            line: lineNumber,
            column: mistake.column,
            severity: mistake.severity,
            message: mistake.message,
            code: mistake.code
          });
        });
      }
    });

    return errors;
  }

  private shouldHaveSemicolon(line: string): boolean {
    const statementKeywords = [
      'digitalWrite', 'pinMode', 'delay', 'Serial.print', 'Serial.begin',
      'analogRead', 'analogWrite', 'return', 'break', 'continue'
    ];
    
    return statementKeywords.some(keyword => line.includes(keyword)) ||
           line.includes('=') && !line.includes('==') && !line.includes('!=');
  }

  private checkUndefinedFunctions(line: string): { name: string; column: number }[] {
    const knownFunctions = [
      'setup', 'loop', 'pinMode', 'digitalWrite', 'digitalRead',
      'analogRead', 'analogWrite', 'delay', 'millis', 'micros',
      'Serial.begin', 'Serial.print', 'Serial.println', 'Serial.read',
      'Serial.available', 'attachInterrupt', 'detachInterrupt',
      'map', 'constrain', 'min', 'max', 'abs', 'pow', 'sqrt',
      'sin', 'cos', 'tan', 'random', 'randomSeed'
    ];

    const functionCallRegex = /(\w+)\s*\(/g;
    const undefined: { name: string; column: number }[] = [];
    let match;

    while ((match = functionCallRegex.exec(line)) !== null) {
      const funcName = match[1];
      if (!knownFunctions.includes(funcName) && 
          !funcName.match(/^(if|for|while|switch|sizeof)$/) &&
          !line.includes(`void ${funcName}`) &&
          !line.includes(`int ${funcName}`) &&
          !line.includes(`#define ${funcName}`)) {
        undefined.push({
          name: funcName,
          column: match.index
        });
      }
    }

    return undefined;
  }

  private checkCommonMistakes(line: string): CompilerError[] {
    const mistakes: CompilerError[] = [];

    // Check for = instead of ==
    if (line.includes('=') && !line.includes('==') && !line.includes('!=') && 
        (line.includes('if') || line.includes('while'))) {
      const index = line.indexOf('=');
      mistakes.push({
        line: 0, // Will be set by caller
        column: index,
        severity: 'warning',
        message: 'Did you mean to use == for comparison?',
        code: 'assignment-in-condition'
      });
    }

    // Check for missing void in function declarations
    if (line.includes('(') && line.includes(')') && line.includes('{') &&
        !line.includes('void') && !line.includes('int') && !line.includes('float') &&
        !line.includes('if') && !line.includes('for') && !line.includes('while')) {
      mistakes.push({
        line: 0,
        column: 0,
        severity: 'error',
        message: 'Function declaration missing return type',
        code: 'missing-return-type'
      });
    }

    return mistakes;
  }

  private async performFullCompilation(code: string) {
    try {
      const result = await compilerService.compileSketch(code, 'uno');
      if (!result.success && result.errors.length > 0) {
        const errors = this.parseCompilerErrors(result.errors);
        this.updateMarkers([...this.markers.map(this.markerToError), ...errors]);
      }
    } catch (error) {
      console.warn('Full compilation failed:', error);
    }
  }

  private parseCompilerErrors(errors: ServiceCompileError[]): CompilerError[] {
    return errors.map(error => ({
      line: error.line,
      column: error.column || 1,
      severity: error.type === 'error' ? 'error' : error.type === 'warning' ? 'warning' : 'info',
      message: error.message,
      code: 'compiler-error'
    }));
  }

  private updateMarkers(errors: CompilerError[]) {
    if (!this.editor) return;

    this.markers = errors.map(error => ({
      startLineNumber: error.line,
      startColumn: error.column,
      endLineNumber: error.line,
      endColumn: error.column + 10,
      message: error.message,
      severity: this.getSeverity(error.severity),
      code: error.code
    }));

    const monaco = getMonaco();
    if (monaco && this.editor) {
      monaco.editor.setModelMarkers(this.editor.getModel()!, 'arduino-compiler', this.markers);
    }
  }

  private getSeverity(severity: string): number {
    const monaco = getMonaco();
    if (!monaco) return 8; // Error severity fallback
    
    switch (severity) {
      case 'error': return monaco.MarkerSeverity.Error;
      case 'warning': return monaco.MarkerSeverity.Warning;
      case 'info': return monaco.MarkerSeverity.Info;
      default: return monaco.MarkerSeverity.Error;
    }
  }

  private markerToError(marker: any): CompilerError {
    const monaco = getMonaco();
    const errorSeverity = monaco?.MarkerSeverity.Error || 8;
    const warningSeverity = monaco?.MarkerSeverity.Warning || 4;
    
    return {
      line: marker.startLineNumber,
      column: marker.startColumn,
      severity: marker.severity === errorSeverity ? 'error' : 
                marker.severity === warningSeverity ? 'warning' : 'info',
      message: marker.message,
      code: marker.code?.toString()
    };
  }

  clearMarkers() {
    const monaco = getMonaco();
    if (monaco && this.editor) {
      monaco.editor.setModelMarkers(this.editor.getModel()!, 'arduino-compiler', []);
    }
    this.markers = [];
  }

  dispose() {
    if (this.compileTimeout) {
      clearTimeout(this.compileTimeout);
    }
    this.clearMarkers();
    this.editor = null;
  }
}

export const realTimeCompiler = new RealTimeCompiler();