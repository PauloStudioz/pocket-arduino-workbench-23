import { useEffect, useRef, useState } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import { Button } from './ui/button';
import { Maximize, Minimize, RotateCcw, Save } from 'lucide-react';
import { enhancedCompiler } from '@/services/enhancedCompiler';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  onSave?: () => void;
  canSave?: boolean;
  isSaving?: boolean;
  onCompilerReady?: (compiler: typeof enhancedCompiler) => void;
}

export const CodeEditor = ({ 
  value, 
  onChange, 
  language = 'cpp', 
  readOnly = false,
  onSave,
  canSave = false,
  isSaving = false,
  onCompilerReady
}: CodeEditorProps) => {
  const editorRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [showRulers, setShowRulers] = useState(false);
  const [previousDecorations, setPreviousDecorations] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorInstance(editor);
    
    // Configure Arduino/C++ language features
    monaco.languages.setLanguageConfiguration('cpp', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    });

    // Define custom theme with error highlighting support
    monaco.editor.defineTheme('arduino-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.arduino', foreground: '#00979D', fontStyle: 'bold' },
        { token: 'constant.arduino', foreground: '#00979D' },
        { token: 'keyword.type', foreground: '#569CD6' },
        { token: 'keyword.control', foreground: '#C586C0' },
        { token: 'keyword.preprocessor', foreground: '#9CDCFE' },
        { token: 'string', foreground: '#CE9178' },
        { token: 'comment', foreground: '#6A9955', fontStyle: 'italic' },
        { token: 'number', foreground: '#B5CEA8' }
      ],
      colors: {
        'editor.background': '#0f1114',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2D2D30',
        'editor.selectionBackground': '#00979D33',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#00979D',
        'editorCursor.foreground': '#00979D',
        'editor.findMatchBackground': '#515C6A',
        'editor.findMatchHighlightBackground': '#EA5C0055',
        'editorBracketMatch.background': '#0064001A',
        'editorBracketMatch.border': '#888888',
        'editorError.foreground': '#ff6b6b',
        'editorError.background': '#ff6b6b20',
        'editorWarning.foreground': '#ffd93d',
        'editorWarning.background': '#ffd93d20'
      }
    });

    // Add Arduino-specific keywords
    monaco.languages.setMonarchTokensProvider('cpp', {
      tokenizer: {
        root: [
          // Arduino functions
          [/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|Serial|begin|print|println|available|read|write)\b/, 'keyword.arduino'],
          // Arduino constants
          [/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|A0|A1|A2|A3|A4|A5|LED_BUILTIN)\b/, 'constant.arduino'],
          // C++ keywords
          [/\b(void|int|float|double|char|bool|String|byte|word|long|short|unsigned)\b/, 'keyword.type'],
          [/\b(if|else|for|while|do|switch|case|default|break|continue|return|true|false|NULL)\b/, 'keyword.control'],
          [/\b(include|define|ifdef|ifndef|endif|pragma)\b/, 'keyword.preprocessor'],
          // Strings
          [/".*?"/, 'string'],
          [/'.*?'/, 'string'],
          // Comments
          [/\/\/.*/, 'comment'],
          [/\/\*[\s\S]*?\*\//, 'comment'],
          // Numbers
          [/\b\d+\.?\d*\b/, 'number']
        ]
      }
    });

    // Enhanced real-time error highlighting with visual feedback
    const updateDecorations = async () => {
      if (!editor) return;
      
      setIsValidating(true);
      try {
        const code = editor.getValue();
        const { errors } = await enhancedCompiler.validateSyntax(code);
        
        // Clear previous error state if no errors found
        if (errors.length === 0) {
          setLastError(null);
          // Clear all decorations when no errors
          const newDecorations = editor.deltaDecorations(previousDecorations, []);
          setPreviousDecorations(newDecorations);
        } else {
          setLastError(errors[0]?.message || 'Syntax error detected');
          highlightErrors(editor, monaco, errors);
        }
      } catch (error) {
        console.error('Error checking syntax:', error);
        setLastError('Validation failed');
      } finally {
        setIsValidating(false);
      }
    };

    // Enhanced debounced syntax checking with validation feedback
    let timeoutId: NodeJS.Timeout;
    editor.onDidChangeModelContent(() => {
      clearTimeout(timeoutId);
      setIsValidating(true);
      timeoutId = setTimeout(updateDecorations, 800); // Slightly longer delay for less aggressive checking
    });

    // Notify parent component that compiler is ready
    if (onCompilerReady) {
      onCompilerReady(enhancedCompiler);
    }
  };

  const highlightErrors = (editor: any, monaco: any, errors: any[]) => {
    const decorations = errors.map(error => ({
      range: new monaco.Range(error.line, 1, error.line, 1000),
      options: {
        isWholeLine: true,
        className: 'error-line-highlight',
        glyphMarginClassName: 'error-glyph-margin',
        hoverMessage: { value: error.message },
        inlineClassName: 'error-inline-decoration'
      }
    }));

    // Apply error styling
    const style = document.createElement('style');
    style.textContent = `
      .error-line-highlight {
        background: rgba(255, 107, 107, 0.08) !important;
        border-left: 3px solid rgba(255, 107, 107, 0.5) !important;
      }
      .error-glyph-margin {
        background: rgba(255, 107, 107, 0.4) !important;
        width: 3px !important;
      }
      .error-inline-decoration {
        border-bottom: 2px wavy rgba(255, 107, 107, 0.6) !important;
      }
      .monaco-editor .margin-view-overlays .line-numbers {
        color: var(--color-text-secondary);
      }
    `;
    
    if (!document.head.querySelector('#error-highlighting-styles')) {
      style.id = 'error-highlighting-styles';
      document.head.appendChild(style);
    }

    // Clear previous decorations and apply new ones
    const newDecorations = editor.deltaDecorations(previousDecorations, decorations);
    setPreviousDecorations(newDecorations);
  };

  const editorOptions = {
    fontSize: fontSize,
    fontFamily: 'Fira Code, Consolas, Monaco, monospace',
    fontLigatures: true,
    minimap: { enabled: !isFullscreen || window.innerWidth > 768 },
    scrollBeyondLastLine: false,
    wordWrap: 'off' as const,
    lineNumbers: 'on' as const,
    folding: true,
    bracketMatching: 'always' as const,
    autoIndent: 'full' as const,
    formatOnPaste: true,
    formatOnType: true,
    readOnly,
    theme: 'arduino-dark',
    mouseWheelZoom: true,
    smoothScrolling: true,
    quickSuggestions: true,
    parameterHints: {
      enabled: true
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'matchingDocuments',
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalScrollbarSize: 12,
      horizontalScrollbarSize: 12,
    },
    automaticLayout: true,
    wordWrapColumn: 120,
    rulers: showRulers ? [80, 120] : []
  };

  useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (onSave && canSave) {
          onSave();
        }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, canSave, isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
  };

  const resetFontSize = () => {
    setFontSize(14);
  };

  const toggleRulers = () => {
    setShowRulers(!showRulers);
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-editor-background' : 'h-full bg-editor-background'} flex flex-col`}>
      {/* Enhanced Mobile-optimized toolbar with status indicators */}
      <div className="flex items-center justify-between p-2 bg-card border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0"
            title={isFullscreen ? "Exit fullscreen (F11)" : "Fullscreen (F11)"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          
          <div className="flex items-center gap-1 text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={decreaseFontSize}
              className="h-6 w-6 p-0 text-xs"
              title="Decrease font size"
            >
              A-
            </Button>
            <span className="px-2 text-muted-foreground min-w-[2rem] text-center">{fontSize}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={increaseFontSize}
              className="h-6 w-6 p-0 text-xs"
              title="Increase font size"
            >
              A+
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFontSize}
              className="h-6 w-6 p-0"
              title="Reset font size"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRulers}
            className={`h-8 px-2 text-xs ${showRulers ? 'bg-accent' : ''}`}
            title="Toggle rulers (80, 120 chars)"
          >
            |
          </Button>

          {/* Validation Status Indicator */}
          <div className="flex items-center gap-2 text-xs">
            {isValidating && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span>Checking...</span>
              </div>
            )}
            {!isValidating && lastError && (
              <div className="flex items-center gap-1 text-red-500 max-w-[200px] truncate" title={lastError}>
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>{lastError}</span>
              </div>
            )}
            {!isValidating && !lastError && (
              <div className="flex items-center gap-1 text-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>OK</span>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeyboardHints(!showKeyboardHints)}
            className={`h-8 px-2 text-xs ${showKeyboardHints ? 'bg-accent' : ''}`}
            title="Toggle keyboard shortcuts"
          >
            ?
          </Button>
        </div>

        {/* Enhanced Save Button with Status */}
        {onSave && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!canSave || isSaving}
            className={`h-8 ${
              isSaving ? 'animate-pulse' : canSave ? 'hover:bg-green-600 hover:text-white' : ''
            }`}
            title="Save file (Ctrl+S)"
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? 'Saving...' : canSave ? 'Save' : 'Saved'}
          </Button>
        )}
      </div>

      {/* Keyboard Shortcuts Hint Panel */}
      {showKeyboardHints && (
        <div className="bg-muted border-b border-border p-2 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="font-semibold">Ctrl+S:</span> Save</div>
            <div><span className="font-semibold">F11:</span> Fullscreen</div>
            <div><span className="font-semibold">Ctrl+Wheel:</span> Zoom</div>
            <div><span className="font-semibold">Ctrl+F:</span> Find</div>
            <div><span className="font-semibold">Ctrl+H:</span> Replace</div>
            <div><span className="font-semibold">Ctrl+/:</span> Comment</div>
            <div><span className="font-semibold">Alt+Up/Down:</span> Move line</div>
            <div><span className="font-semibold">Ctrl+D:</span> Select word</div>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={editorOptions}
          theme="arduino-dark"
        />
      </div>
    </div>
  );
};
