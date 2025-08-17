import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';
import { serialService } from '@/services/serialService';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Trash2, 
  Download, 
  Pause, 
  Play, 
  Filter,
  BarChart3,
  Settings,
  Copy,
  Save
} from 'lucide-react';

interface SerialMessage {
  timestamp: number;
  data: string;
  type: 'received' | 'sent' | 'info' | 'error';
  formatted?: string;
}

export const EnhancedSerialMonitor = () => {
  const [messages, setMessages] = useState<SerialMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [lineEnding, setLineEnding] = useState('\\n');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Enhanced message processing
  useEffect(() => {
    const handleSerialMessage = (message: { id: string; timestamp: Date; message: string; type: 'received' | 'sent' | 'error' | 'info' }) => {
      if (isPaused) return;

      const newMessage: SerialMessage = {
        timestamp: message.timestamp.getTime(),
        data: message.message,
        type: message.type,
        formatted: formatMessage(message.message, message.type)
      };

      setMessages(prev => {
        const updated = [...prev, newMessage];
        // Keep only last 1000 messages for performance
        return updated.slice(-1000);
      });

      // Auto-scroll to bottom
      if (autoScroll) {
        setTimeout(() => {
          if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
          }
        }, 50);
      }
    };

    serialService.addMessageListener(handleSerialMessage);
    setIsConnected(serialService.getConnectionStatus());

    return () => {
      serialService.removeMessageListener(handleSerialMessage);
    };
  }, [isPaused, autoScroll]);

  const formatMessage = (message: string, type: string): string => {
    // Add timestamp if enabled
    const timestamp = showTimestamps ? 
      `[${new Date().toLocaleTimeString()}] ` : '';
    
    // Format based on type
    switch (type) {
      case 'error':
        return `${timestamp}ERROR: ${message}`;
      case 'info':
        return `${timestamp}INFO: ${message}`;
      default:
        return `${timestamp}${message}`;
    }
  };

  const handleConnect = async () => {
    try {
      if (isConnected) {
        await serialService.disconnect();
        setIsConnected(false);
        addInfoMessage('Disconnected from Arduino');
      } else {
        const connected = await serialService.connect(baudRate);
        if (connected) {
          setIsConnected(true);
          addInfoMessage(`Connected at ${baudRate} baud`);
        }
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to ${isConnected ? 'disconnect from' : 'connect to'} Arduino`,
        variant: "destructive",
      });
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !isConnected) return;

    const messageToSend = inputValue + (lineEnding === '\\n' ? '\n' : lineEnding === '\\r\\n' ? '\r\n' : '');
    
    try {
      await serialService.sendMessage(messageToSend);
      
      const sentMessage: SerialMessage = {
        timestamp: Date.now(),
        data: inputValue,
        type: 'sent',
        formatted: `→ ${inputValue}`
      };
      
      setMessages(prev => [...prev, sentMessage]);
      setInputValue('');
    } catch (error) {
      toast({
        title: "Send Error",
        description: "Failed to send message to Arduino",
        variant: "destructive",
      });
    }
  }, [inputValue, isConnected, lineEnding]);

  const addInfoMessage = (message: string) => {
    const infoMessage: SerialMessage = {
      timestamp: Date.now(),
      data: message,
      type: 'info',
      formatted: formatMessage(message, 'info')
    };
    setMessages(prev => [...prev, infoMessage]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const exportMessages = () => {
    const data = messages.map(msg => 
      `${new Date(msg.timestamp).toISOString()}: ${msg.data}`
    ).join('\n');
    
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arduino_serial_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const text = messages.map(msg => msg.formatted || msg.data).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied",
        description: "Messages copied to clipboard",
      });
    });
  };

  const filteredMessages = messages.filter(msg => 
    !filterText || msg.data.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Serial Monitor
          </h2>
          <div className="flex gap-1">
            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="h-8 px-2"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              className="h-8 px-3 text-xs"
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Filter messages..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="flex-1 h-8 text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-8 w-8 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportMessages}
            className="h-8 w-8 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Message Display */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="monitor" className="h-full flex flex-col">
          <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2 bg-muted/50">
            <TabsTrigger value="monitor" className="text-xs">Monitor</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="flex-1 mt-2 mx-3 mb-3">
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 p-3 overflow-hidden">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                  <div className="space-y-1">
                    {filteredMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono p-2 rounded ${
                          message.type === 'sent' ? 'bg-primary/10 text-primary' :
                          message.type === 'error' ? 'bg-destructive/10 text-destructive' :
                          message.type === 'info' ? 'bg-muted/50 text-muted-foreground' :
                          'bg-background text-foreground'
                        }`}
                      >
                        {message.formatted || message.data}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 mt-2 mx-3 mb-3">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Monitor Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Baud Rate</label>
                  <select 
                    value={baudRate} 
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="w-full h-8 px-2 text-xs border border-input bg-background rounded"
                  >
                    <option value={9600}>9600</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={57600}>57600</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Line Ending</label>
                  <select 
                    value={lineEnding} 
                    onChange={(e) => setLineEnding(e.target.value)}
                    className="w-full h-8 px-2 text-xs border border-input bg-background rounded"
                  >
                    <option value="\\n">Newline (\\n)</option>
                    <option value="\\r\\n">Carriage Return + Newline (\\r\\n)</option>
                    <option value="">No line ending</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Show Timestamps</label>
                  <Switch 
                    checked={showTimestamps} 
                    onCheckedChange={setShowTimestamps} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Auto Scroll</label>
                  <Switch 
                    checked={autoScroll} 
                    onCheckedChange={setAutoScroll} 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Input Area */}
      {isConnected && (
        <div className="p-3 border-t border-border bg-card">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Send a message to Arduino..."
              className="flex-1 h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim()}
              size="sm"
              className="h-8 px-3"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
