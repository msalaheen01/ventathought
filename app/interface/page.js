'use client'
import React from 'react';
import { useState, useEffect, useRef } from "react";
import { Box, Typography, Paper, Avatar, IconButton, TextField, Button, Switch, CssBaseline, ThemeProvider, FormControl, InputLabel, Select, MenuItem, CircularProgress } from "@mui/material";
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import useMediaQuery from '@mui/material/useMediaQuery';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useUser } from "@auth0/nextjs-auth0/client";
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  AppBar, 
  Toolbar, 
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useRouter } from 'next/navigation';
import LogoutIcon from '@mui/icons-material/Logout';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ManIcon from '@mui/icons-material/Man';
import WomanIcon from '@mui/icons-material/Woman';

const DynamicRing = ({ size, thickness, rgbColor, value }) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', m: 1 }}>
      <CircularProgress
        variant="determinate"
        value={value}
        size={size}
        thickness={thickness}
        sx={{
          color: rgbColor,
        }}
      />
    </Box>
  );
};

const generateRandomPosition = (max, size) => {
  return Math.floor(Math.random() * (max - size));
};

export default function Home() {
    const [currentURL, setCurrentURL] = useState('');
    const { user, error, isLoading } = useUser();

    useEffect(() => {
        setCurrentURL(window.location.href);
    }, []);

    const [messages, setMessages] = useState([
      {
        role: 'assistant',
        content: `Hey there! What's on your mind today?`
      }
    ])
    const [message, setMessage ] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [darkMode, setDarkMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [userId, setUserId] = useState(Math.random().toString(36).substr(2, 9)); // Add this line
    const [selectedVoice, setSelectedVoice] = useState('alloy');

    const sendMessage = async (e) => {
      if (!message.trim()) return; 

      setMessage('')
      setMessages((messages)=>[
        ...messages,
        { role: 'user', content: message },
        { role: 'assistant', content: '' },
      ])
      setIsChatLoading(true)

      try {
        console.log("")
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'URL': currentURL,
          },
          body: JSON.stringify({
            user_id: user ? user.sub : 'anonymous',
            data: [...messages, { role: 'user', content: message }],
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          setMessages((messages)=>{
            let lastMessage = messages[messages.length - 1]
            let otherMessages = messages.slice(0, messages.length - 1)
            return [
              ...otherMessages,
              {
                ...lastMessage,
                content: lastMessage.content + chunk,
              },
            ]
          })           
        }
      } catch (error) {
        console.error('Error:', error)
        setMessages((messages) => [
          ...messages,
          { 
            role: 'assistant', 
            content: "I'm sorry, but I encountered an error. Please try again later." 
          },
        ])
      } finally {
        setIsChatLoading(false)
      }
    }

    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    }

    const messagesEndRef = useRef(null)

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  
    useEffect(() => {
      scrollToBottom()
    }, [messages])

    const synthesizeSpeech = async (text) => {
      try {
        console.log('Synthesizing speech for:', text);
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, voice: selectedVoice }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        console.log('Received audio blob:', audioBlob);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onerror = (e) => console.error('Audio playback error:', e);
        audio.onplay = () => console.log('Audio started playing');
        audio.onended = () => console.log('Audio finished playing');
        await audio.play();
      } catch (error) {
        console.error('Error synthesizing speech:', error);
      }
    };

    const renderMessage = (message) => (
      <Box>
        <ReactMarkdown
          components={{
            code({node, inline, className, children, ...props}) {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <SyntaxHighlighter
                  style={tomorrow}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
        {message.role === 'assistant' && (
          <IconButton size="small" onClick={() => synthesizeSpeech(message.content)}>
            <VolumeUpIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );

    const startListening = async () => {
      setIsListening(true);
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript;
          setMessage(speechResult);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
      }
    };
  // end chat store the conversation to pinecone
    const endChat = async () => {
      console.log("End Chat clicked");
      if (isChatLoading || isLoading) {
        console.log("Loading in progress, can't end chat");
        return;
      }
      if (error) {
        console.error('Error loading user:', error);
        return;
      }
      if (!user) {
        console.log('User not authenticated, ending chat anyway');
        // You might want to handle this case differently
      }

      const chatHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      try {
        const response = await fetch('/api/uploadChat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'URL': currentURL,
          },
          body: JSON.stringify({
            user_id: user ? user.sub : 'anonymous',
            chat_history: chatHistory,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to upload chat history');
        }

        const result = await response.json();
        alert(result.message);

        // Reset the chat
        setMessages([
          {
            role: 'assistant',
            content: `Hey there! What's on your mind today?`
          }
        ]);
      } catch (error) {
        console.error('Error ending chat:', error);
        alert('Failed to save chat history. Please try again.');
      }
    };
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => setIsOpen(!isOpen);

    const router = useRouter();

    const handleLogout = () => {
        // Implement logout logic here
        // For example, clear local storage, reset state, etc.
        router.push('/'); // Redirect to page.js
    };

    const generateRandomColor = () => {
      return `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
    };

    const generateRandomSize = () => {
      return Math.floor(Math.random() * (80 - 20 + 1)) + 20; // Random size between 20 and 80
    };

    const generateRings = (count) => {
      const rings = [];
      const occupiedSpaces = [];
      const drawerWidth = 380;
      const drawerHeight = 680; // Approximate height, adjust if needed

      for (let i = 0; i < count; i++) {
        let ring;
        let overlapping;
        do {
          overlapping = false;
          ring = {
            size: generateRandomSize(),
            color: generateRandomColor(),
            value: Math.floor(Math.random() * 101), // Random value between 0 and 100
            top: generateRandomPosition(drawerHeight, ring?.size || 0),
            left: generateRandomPosition(drawerWidth, ring?.size || 0),
          };

          // Check for overlap with existing rings
          for (const occupiedSpace of occupiedSpaces) {
            const distance = Math.sqrt(
              Math.pow(ring.left - occupiedSpace.left, 2) +
              Math.pow(ring.top - occupiedSpace.top, 2)
            );
            if (distance < (ring.size / 2 + occupiedSpace.size / 2)) {
              overlapping = true;
              break;
            }
          }
        } while (overlapping);

        rings.push(ring);
        occupiedSpaces.push(ring);
      }
      return rings;
    };

    const rings = generateRings(20); // Generate 20 non-overlapping rings

    return (
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <CssBaseline />
      
        <Box sx={{ 
          position: 'fixed', 
          left: 50, 
          top: 50, 
          bottom: 50, 
          width: 380, 
          zIndex: 1200,
          boxShadow: 6,
          borderRadius: 2,
          overflow: 'hidden'
        }}>
          <Drawer
            variant="permanent"
            sx={{
              width: 380,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 380,
                boxSizing: 'border-box',
                position: 'static',
                height: '100%',
                borderRadius: 2,
              },
            }}
          >
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Dynamic Rings */}
              {rings.map((ring, index) => (
                <Box
                  key={index}
                  sx={{
                    position: 'absolute',
                    top: ring.top,
                    left: ring.left,
                    zIndex: 0,
                  }}
                >
                  <DynamicRing
                    size={ring.size}
                    thickness={Math.min(8, ring.size / 6)}
                    rgbColor={ring.color}
                    value={100}
                  />
                </Box>
              ))}

              <Typography variant="h6" sx={{ p: 2, position: 'relative', zIndex: 1 }}>
                VentAThought
              </Typography>
              
              {/* Large avatars */}
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4, position: 'relative', zIndex: 1 }}>
                <Avatar sx={{ width: 80, height: 80, mr: 2 }}>
                  <ManIcon sx={{ fontSize: 60 }} />
                </Avatar>
                <Avatar sx={{ width: 80, height: 80 }}>
                  <WomanIcon sx={{ fontSize: 60 }} />
                </Avatar>
              </Box>

              <List sx={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
                {['Item 1', 'Item 2', 'Item 3'].map((text, index) => (
                  <ListItem button key={text}>
                    <ListItemText primary={text} />
                  </ListItem>
                ))}
              </List>
              
              {/* Theme toggle and logout */}
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
                    {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                  </IconButton>
                  <Typography variant="body2">
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </Typography>
                </Box>
                <IconButton onClick={handleLogout} color="inherit">
                  <LogoutIcon />
                </IconButton>
              </Box>
            </Box>
          </Drawer>
        </Box>

        <Box component="main" sx={{ 
          flexGrow: 1, 
          p: 3, 
          pl: '430px', 
          display: 'flex', 
          flexDirection: 'column',
          mt: '50px', // Add top margin
          mx: '200px', // Add horizontal margin
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <FormControl variant="outlined" size="small">
              <InputLabel id="voice-select-label">Voice</InputLabel>
              <Select
                labelId="voice-select-label"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                label="Voice"
              >
                <MenuItem value="alloy">Vent</MenuItem>
                <MenuItem value="nova">Venta</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              color="secondary"
              onClick={endChat}
              disabled={isChatLoading || isLoading}
            >
              End Chat
            </Button>
          </Box>

          <Paper sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            height: 'calc(100vh - 200px)', // Adjust height to account for top margin and padding
          }}>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
              {messages.map((message, index) => (
                <Box key={index} sx={{ display: 'flex', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {message.role === "assistant" ? (
                      <Avatar>
                        <SmartToyIcon />
                      </Avatar>
                    ) : (
                      <Avatar>
                        <PersonIcon />
                      </Avatar>
                    )}
                    <Box>
                      {renderMessage(message)}
                    </Box>
                  </Box>
                </Box>
              ))}
              {isChatLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>
            <Box component="form" onSubmit={(e) => { e.preventDefault(); sendMessage(); }} sx={{ display: 'flex', p: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                sx={{ mr: 1 }}
              />
              <IconButton
                color="primary"
                onClick={startListening}
                disabled={isListening}
              >
                <MicIcon />
              </IconButton>
              <Button 
                variant="contained" 
                endIcon={<SendIcon />}
                type="submit"
                disabled={isChatLoading}
              >
                Send
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
}