import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Send, Trash2, Play, Square } from 'lucide-react';
import { serialService, SerialMessage } from '@/services/serialService';
import { useToast } from '@/hooks/use-toast';

export const SerialMonitor = () => {
  const [messages, setMessages] = useState<SerialMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState('9600');
  const [isConnecting, setIsConnecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleMessage = (message: SerialMessage) => {
      setMessages(prev => [...prev, message]);
    };

    serialService.addMessageListener(handleMessage);
    setIsConnected(serialService.getConnectionStatus());

    // Initialize with welcome message
    if (messages.length === 0) {
      const initMessage: SerialMessage = {
        id: '1',
        timestamp: new Date(),
        message: 'Serial Monitor initialized. Click Connect to start.',
        type: 'info'
      };
      setMessages([initMessage]);
    }

    return () => {
      serialService.removeMessageListener(handleMessage);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;
    
    const success = await serialService.sendMessage(inputMessage);
    if (success) {
      setInputMessage('');
    }
  };

  const handleConnect = async () => {
    if (isConnected) {
      await serialService.disconnect();
      setIsConnected(false);
    } else {
      setIsConnecting(true);
      
      // Check if Web Serial is supported
      const isSupported = await serialService.isWebSerialSupported();
      if (!isSupported) {
        toast({
          title: "Web Serial Not Supported",
          description: "Your browser doesn't support Web Serial API. Try Chrome or Edge.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const success = await serialService.connect(parseInt(baudRate));
      setIsConnected(success);
      setIsConnecting(false);
      
      if (!success) {
        toast({
          title: "Connection Failed",
          description: "Failed to connect to serial port. Make sure the device is connected.",
          variant: "destructive",
        });
      }
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const getMessageColor = (type: SerialMessage['type']) => {
    switch (type) {
      case 'sent':
        return 'text-primary';
      case 'received':
        return 'text-console-foreground';
      case 'error':
        return 'text-console-error';
      case 'info':
        return 'text-console-warning';
      default:
        return 'text-console-foreground';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-console-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Badge 
            variant={isConnected ? "default" : "secondary"}
            className={isConnected ? "bg-status-connected" : "bg-status-disconnected"}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <select 
            value={baudRate} 
            onChange={(e) => setBaudRate(e.target.value)}
            className="px-3 py-1 bg-input border border-border rounded text-sm"
            disabled={isConnected}
          >
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            className={isConnected ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {isConnected ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isConnecting ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect')}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 console-text custom-scrollbar">
        <div className="space-y-1">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 text-sm">
              <span className="text-console-warning text-xs font-mono min-w-[60px]">
                {formatTime(msg.timestamp)}
              </span>
              <span className={`font-mono ${getMessageColor(msg.type)}`}>
                {msg.type === 'sent' && '> '}
                {msg.message}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isConnected ? "Enter command..." : "Connect to send messages"}
            disabled={!isConnected}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="font-mono"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};