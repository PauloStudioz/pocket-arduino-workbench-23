import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Code2, 
  Play, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Search,
  Type,
  Braces,
  Hash,
  Quote
} from 'lucide-react';

interface MobileCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  onSave?: () => void;
  canSave?: boolean;
  isSaving?: boolean;
}

const MobileCodeEditor = ({ 
  value, 
  onChange, 
  language = 'cpp', 
  onSave, 
  canSave, 
  isSaving 
}: MobileCodeEditorProps) => {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { toast } = useToast();

  const lines = value.split('\n');
  const lineCount = lines.length;

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Update cursor position
    const textarea = e.target;
    const textBeforeCursor = newValue.substring(0, textarea.selectionStart);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const line = linesBeforeCursor.length;
    const column = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1;
    
    setCursorPosition({ line, column });
  }, [onChange]);

  const insertText = useCallback((text: string) => {
    const textarea = document.querySelector('textarea[data-editor="main"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  }, [value, onChange]);

  const formatCode = useCallback(() => {
    // Basic C++ formatting
    let formatted = value
      .split('\n')
      .map((line, index) => {
        let trimmed = line.trim();
        let indent = 0;
        
        // Count braces before this line for indentation
        for (let i = 0; i < index; i++) {
          const prevLine = lines[i];
          indent += (prevLine.match(/\{/g) || []).length;
          indent -= (prevLine.match(/\}/g) || []).length;
        }
        
        // Adjust for closing brace on current line
        if (trimmed.startsWith('}')) {
          indent = Math.max(0, indent - 1);
        }
        
        return '  '.repeat(indent) + trimmed;
      })
      .join('\n');
    
    onChange(formatted);
    toast({
      title: "Code Formatted",
      description: "Your code has been auto-formatted.",
    });
  }, [value, lines, onChange, toast]);

  const quickInserts = [
    { label: 'setup()', code: 'void setup() {\n  \n}' },
    { label: 'loop()', code: 'void loop() {\n  \n}' },
    { label: 'digitalWrite', code: 'digitalWrite(pin, HIGH);' },
    { label: 'digitalRead', code: 'digitalRead(pin)' },
    { label: 'Serial.begin', code: 'Serial.begin(9600);' },
    { label: 'delay', code: 'delay(1000);' },
    { label: 'if statement', code: 'if (condition) {\n  \n}' },
    { label: 'for loop', code: 'for (int i = 0; i < 10; i++) {\n  \n}' },
  ];

  return (
    <div className={`flex flex-col h-full bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Mobile Toolbar */}
      <div className="flex items-center justify-between p-2 bg-card border-b border-border">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="h-8 px-2"
          >
            <Hash className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-8 px-2"
          >
            <Search className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={formatCode}
            className="h-8 px-2"
          >
            <Braces className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 px-2"
          >
            {isFullscreen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
          {onSave && (
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={!canSave || isSaving}
              className="h-8 px-3 text-xs"
            >
              {isSaving ? '...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="p-2 bg-card border-b border-border">
          <input
            type="text"
            placeholder="Search in code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
          />
        </div>
      )}

      {/* Code Editor */}
      <div className="flex-1 flex relative">
        {/* Line Numbers */}
        {showLineNumbers && (
          <div className="bg-muted text-muted-foreground text-xs font-mono p-2 pr-1 border-r border-border min-w-[3rem]">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="h-5 leading-5 text-right">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Main Editor */}
        <div className="flex-1 relative">
          <textarea
            data-editor="main"
            value={value}
            onChange={handleTextareaChange}
            className="w-full h-full p-2 bg-background text-foreground font-mono text-sm resize-none border-none outline-none leading-5"
            placeholder="// Start coding your Arduino sketch here..."
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              tabSize: 2,
              fontSize: '14px',
              lineHeight: '20px'
            }}
          />
        </div>
      </div>

      {/* Quick Insert Toolbar */}
      <div className="p-2 bg-card border-t border-border">
        <ScrollArea className="w-full">
          <div className="flex gap-1 pb-1">
            {quickInserts.map((insert, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => insertText(insert.code)}
                className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
              >
                {insert.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted text-xs text-muted-foreground">
        <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        <span>{lineCount} lines • {language.toUpperCase()}</span>
      </div>
    </div>
  );
};

export default MobileCodeEditor;