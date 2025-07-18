"use client";
import React, { useState, useRef, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { FaRobot, FaUserCircle, FaRegThumbsUp, FaRegThumbsDown, FaRegCommentDots, FaVolumeUp, FaPaperPlane, FaRegSmile, FaMicrophone, FaPause, FaPlay, FaCopy, FaCheck, FaWhatsapp } from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { useSupabase } from '../providers/SupabaseProvider';
import { useTheme } from '../providers/ThemeProvider';
import { useLanguage } from '../../lib/LanguageContext';
import { useTranslation, Language } from '../../lib/i18n';
import TypewriterEffect from '../../components/TypewriterEffect';
import CommentModal from '../../components/CommentModal';
import VoiceModal from '../../components/VoiceModal';
import TypingIndicator from '../../components/TypingIndicator';
import dynamic from 'next/dynamic';
import data from '@emoji-mart/data';
import ReactModal from 'react-modal';
import { Toaster } from 'react-hot-toast';
import { useNotification } from '../../lib/hooks/useNotification';
import { copyMessageContent, isPostResponse } from '../../lib/utils/messageUtils';
import { getBrowserLanguage } from '@/lib/i18n';


const Modal: any = ReactModal;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactMarkdown = require('react-markdown').default;

const EmojiPicker = dynamic(() => import('@emoji-mart/react'), {
  ssr: false
});

interface Message {
  id: string;
  content: string;
  user: 'me' | 'bot';
  created_at: string;
  image?: string;
}

const languageNames: Record<string, string> = {
  'pt': 'Portuguese',
  'en': 'English',
  'es': 'Spanish'
};

const ChatComponent = () => {
  const { user, signOut } = useSupabase();
  const { dark, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation(language as Language);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [commentModal, setCommentModal] = useState<{ open: boolean, message?: { id: string, content: string } }>({ open: false });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [voiceMode, setVoiceMode] = useState<'idle' | 'recording' | 'ai-speaking'>('idle');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [voiceModalMode, setVoiceModalMode] = useState<'ai-speaking' | 'ready-to-record' | 'recording' | 'thinking' | 'loading'>('ai-speaking');
  const [greetingLoading, setGreetingLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [isTypewriterActive, setIsTypewriterActive] = useState(false);
  const [ttsLoadingMsgId, setTtsLoadingMsgId] = useState<string | null>(null);
  const [tooltips, setTooltips] = useState<string[]>([]);
  const [showTooltips, setShowTooltips] = useState(true);
  const [showTooltipsModal, setShowTooltipsModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [postTopic, setPostTopic] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState<string | null>(null);
  const [imageText, setImageText] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioProgressInterval = useRef<NodeJS.Timeout | null>(null);
  const voiceModalRef = useRef<HTMLDivElement>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const notify = useNotification();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getBrowserLanguage());


  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;

    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    // Se o usuário rolar para cima, desative o auto-scroll
    if (!atBottom) {
      setShouldAutoScroll(false);
      setUserScrolled(true);
      // Adiciona delay para mostrar o botão
      setTimeout(() => {
        setShowScrollButton(true);
      }, 1500);
    }

    // Se o usuário rolar até o final, reative o auto-scroll
    if (atBottom) {
      setShouldAutoScroll(true);
      setUserScrolled(false);
      setShowScrollButton(false);
    }

    setIsNearBottom(atBottom);
  };

  // Efeito para scroll automático apenas quando necessário
  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0 && !userScrolled && !isTypewriterActive) {
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, shouldAutoScroll, userScrolled, isTypewriterActive]);

  // Efeito para o typewriter
  useEffect(() => {
    if (isTypewriterActive && shouldAutoScroll && !userScrolled) {
      // Reduz a frequência do scroll automático durante o typewriter
      const interval = setInterval(() => {
        if (messagesEndRef.current && isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500); // Aumentado de 100ms para 500ms
      return () => clearInterval(interval);
    }
  }, [isTypewriterActive, shouldAutoScroll, userScrolled, isNearBottom]);

  // Adicione um botão de scroll para baixo quando não estiver no final
  const scrollToBottom = () => {
    setShouldAutoScroll(true);
    setUserScrolled(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    if (!user) {
      router.push('/sign-in');
    }
  }, [user, router]);

  React.useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].user === 'bot' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages]);

  const resetConversationState = () => {
    setSelectedPlatform(null);
    setPostTopic(null);
  };

  useEffect(() => {
    if (messages.length === 0) {
      resetConversationState();
      setGreetingLoading(true);
      (async () => {
        try {
          const [instructionsRes, knowledgeRes] = await Promise.all([
            fetch('/AI_INSTRUCTIONS.md'),
            fetch('/AI_KNOWLEDGE.md'),
          ]);
          const instructionsText = await instructionsRes.text();
          const knowledgeText = await knowledgeRes.text();
          const greetingPrompt = `Generate a creative, warm, and original greeting for a new user in ${language}. Use the INSTRUCTIONS to define the tone and style of the message. The greeting should be professional and welcoming, introducing yourself as a social media content assistant that can help generate posts for Instagram, LinkedIn, or Facebook. Keep your answer very short (1-2 sentences).`;
          const res = await fetch('/api/chatgpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: greetingPrompt, language }),
          });
          const data = await res.json();
          setMessages([
            {
              id: 'welcome',
              content: data.reply && data.reply.trim() ? data.reply : t('chat.greeting'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (err) {
          setMessages([
            {
              id: 'welcome',
              content: t('chat.greeting'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
        } finally {
          setGreetingLoading(false);
        }
      })();
    }
  }, [language]);

  useEffect(() => {
    if (messages.length === 0) {
      let allTooltips: string[] = [];
      const tt = t('chat.tooltips');
      if (Array.isArray(tt)) {
        allTooltips = tt;
      }
      const shuffled = [...allTooltips].sort(() => 0.5 - Math.random());
      setTooltips(shuffled.slice(0, 4));
      setShowTooltips(true);
    }
  }, [language, messages.length]);

  const handleFirstInteraction = () => {
    if (showTooltips) setShowTooltips(false);
  };

  const playTTS = async (text: string, messageId: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return;

    if (currentAudioId === messageId && isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (audioProgressInterval.current) {
          clearInterval(audioProgressInterval.current);
        }
      }
      return;
    }

    if (currentAudioId === messageId && !isPlaying && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      audioProgressInterval.current = setInterval(() => {
        if (audioRef.current) {
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setAudioProgress(progress);
        }
      }, 100);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioProgressInterval.current) {
        clearInterval(audioProgressInterval.current);
      }
    }

    setCurrentAudioId(messageId);
    setTtsLoadingMsgId(messageId);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        if (!audioProgressInterval.current) {
          setAudioProgress(0);
        }
        setTtsLoadingMsgId(null);
        audioProgressInterval.current = setInterval(() => {
          if (audioRef.current) {
            const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setAudioProgress(progress);
          }
        }, 100);
      };

      audio.onpause = () => {
        setIsPlaying(false);
        if (audioProgressInterval.current) {
          clearInterval(audioProgressInterval.current);
          audioProgressInterval.current = null;
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudioId(null);
        setAudioProgress(0);
        setTtsLoadingMsgId(null);
        if (audioProgressInterval.current) {
          clearInterval(audioProgressInterval.current);
          audioProgressInterval.current = null;
        }
        if (onEnd) onEnd();
      };

      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setCurrentAudioId(null);
      setIsPlaying(false);
      setTtsLoadingMsgId(null);
      if (onEnd) onEnd();
    }
  };

  const speakBotMessage = async (text: string) => {
    if (typeof window === 'undefined') return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const extractPlatform = (text: string): string | null => {
    const platforms = ['instagram', 'linkedin', 'facebook'];
    const lower = text.toLowerCase();
    // Primeiro, procura por menções diretas à plataforma
    const directMatch = platforms.find((p) => lower.includes(p));
    if (directMatch) return directMatch;

    // Se não encontrar menção direta, procura por variações comuns
    const variations: Record<string, string[]> = {
      'linkedin': ['linkedin', 'linked in', 'linked-in'],
      'instagram': ['instagram', 'insta', 'ig'],
      'facebook': ['facebook', 'fb', 'face']
    };

    for (const [platform, vars] of Object.entries(variations)) {
      if (vars.some(v => lower.includes(v))) return platform;
    }

    return null;
  };

  const extractTopic = (text: string, platform: string | null): string | null => {
    if (!text) return null;
    let topic = text;

    // Remove menções à plataforma
    if (platform) {
      const variations = {
        'linkedin': ['linkedin', 'linked in', 'linked-in'],
        'instagram': ['instagram', 'insta', 'ig'],
        'facebook': ['facebook', 'fb', 'face']
      };
      const platformVars = variations[platform as keyof typeof variations] || [platform];
      platformVars.forEach(p => {
        topic = topic.replace(new RegExp(p, 'i'), '').trim();
      });
    }

    // Remove palavras comuns de comando
    const commandWords = [
      'escreva', 'escreve', 'write', 'crie', 'create', 'haz', 'fais', 'erstelle',
      'schreibe', 'make', 'generate', 'génère', 'genera', 'criar', 'ajuda', 'help',
      'sobre', 'about', 'para', 'for', 'pour', 'für', 'post', 'postar', 'publicar',
      'publish', 'share', 'compartilhar'
    ];

    commandWords.forEach(word => {
      topic = topic.replace(new RegExp(`^${word}\\s*`, 'i'), '').trim();
    });

    if (topic.length > 2) return topic;
    return null;
  };

  const generatePostPrompt = (platform: string, topic: string, imageDescription?: string, imageText?: string) => {
    const conversationInstructions = `You are a friendly, expert social media content assistant. Your main focus is to help the user specify the social media platform (Instagram, LinkedIn, or Facebook) and the content/topic for their post. Guide the user to provide both, but do so naturally and contextually in the flow of conversation. If the user is asking a question, discussing strategy, or just chatting, answer helpfully and conversationally. You can process and analyze images uploaded by users to create more engaging posts. When users ask about image uploads, inform them that you can receive and analyze their images to enhance their posts. Only generate a complete, ready-to-use post for ${platform} about "${topic}" if the user clearly requests it or if the context makes it appropriate and both platform and topic are clear. When generating a post, use best practices for formatting, tone, hashtags, and calls-to-action. If you have extra recommendations (such as best time to post, engagement tips, or suggestions), add them at the end of the post as a final section called 'Tips:'. Do not greet the user except at the very start of a new chat. Otherwise, keep the conversation natural and helpful.`;

    const postFormatInstructions = `Create a social media post for ${platform} about "${topic}".

    ${imageDescription ? `Image Description: ${imageDescription}
    User's Context: ${imageText || ''}` : ''}

    Please create a post that:
    1. ${imageDescription ? 'Incorporates both the image analysis and the user\'s provided context' : 'Focuses on the main topic'}
    2. Follows best practices for ${platform}
    3. Includes a clear call-to-action
    4. Uses relevant hashtags
    5. Maintains an appropriate tone for the platform
    6. Do not include any instruction labels like "Call-to-Action:", "Tips:" or "Hashtags:" in the final text

    CRITICAL FORMATTING RULES (MUST BE FOLLOWED IN ALL LANGUAGES):
    1. Start with a brief comment about the post idea (1-2 sentences)
    2. Add a horizontal line (exactly three dashes: ---)
    3. Write the post content
    4. Add another horizontal line (exactly three dashes: ---)
    5. Add the tips section
    6. Do not include any instruction labels like "Call-to-Action:", "Tips:" or "Hashtags:" in the text


    The horizontal lines (---) are MANDATORY and must be placed exactly as shown below:

    [Your brief comment about the post]

    ---
    [Your post content here]
    ---
    
    • [Your tips here]

    IMPORTANT: 
    - The horizontal lines (---) are REQUIRED and must be placed exactly as shown above, regardless of the language used. The post content MUST be between these two horizontal lines.
    - Include the tips section in the same message as the post. The tips section should:
    - Be titled [TIPS] section in italics. Important: the title must be in language of the user.
    - Use a vertical, block-style layout
    - Keep tips concise and actionable
    - Be part of the same message as the post, not a separate message

    REMEMBER: Your response MUST follow this exact format in ALL languages. The horizontal lines (---) are MANDATORY and must be placed exactly as shown.`;

    return `${conversationInstructions}\n\n${postFormatInstructions}`;
  };

  const generateFollowupPrompt = (type: 'platform' | 'topic', platform?: string, topic?: string, imageText?: string, imageDescription?: string) => {
    if (type === 'platform') {
      return `The user wants to create a post about "${topic}". Ask them in a friendly, creative, and context-aware way which social media platform they want to use (Instagram, LinkedIn, or Facebook). Respond only with your question.`;
    } else {
      if (imageText && imageDescription) {
        return `The user uploaded an image with the following context: "${imageText}"

        Image Description: ${imageDescription}
        Selected Platform: ${platform}

        Ask the user in a friendly, creative, and context-aware way what specific topic or content they want to post about on ${platform}. Respond only with your question.`;
      } else {
        return `The user wants to create a post for ${platform}. Ask them in a friendly, creative, and context-aware way what topic or content they want to post about. Respond only with your question.`;
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    handleFirstInteraction();
    setLoading(true);
    setIsTyping(true);

    const userMsg: Message = {
      id: 'user-' + Date.now(),
      content: newMessage,
      user: 'me',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setNewMessage('');

    const platform = selectedPlatform || extractPlatform(newMessage);
    const topic = postTopic || extractTopic(newMessage, platform);
    const extractedTopic = extractTopic(newMessage, platform);

    if (platform && topic) {
      const prompt = generatePostPrompt(platform, topic);
      const openaiMessages = [
        { role: 'system', content: prompt },
        ...messages.map((msg) => ({
          role: msg.user === 'me' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: newMessage }
      ];
      try {
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: openaiMessages, language }),
        });
        const data = await res.json();
        
        // Atualiza o idioma atual se um novo idioma foi detectado
        if (data.detectedLanguage && data.detectedLanguage !== language) {
          setLanguage(data.detectedLanguage);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply || t('chat.fallback'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
        setImageDescription(null);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
      return;
    }

    if (platform && !topic) {
      setSelectedPlatform(platform);
      setPostTopic(null);
      if (!extractedTopic) {
        const followupPrompt = generateFollowupPrompt('topic', platform);
        try {
          const res = await fetch('/api/chatgpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: followupPrompt, language }),
          });
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: 'bot-' + Date.now(),
              content: data.reply || t('chat.fallback'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              id: 'bot-error-' + Date.now(),
              content: t('common.error'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
        } finally {
          setLoading(false);
          setIsTyping(false);
        }
      }
      return;
    }

    if (!platform && newMessage.trim()) {
      setPostTopic(newMessage);
      const followupPrompt = generateFollowupPrompt('platform', undefined, newMessage);
      try {
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followupPrompt, language }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply || t('chat.fallback'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
      return;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  const handleFeedback = async (messageId: string, type: 'like' | 'dislike', content: string) => {
    setFeedback((prev) => ({
      ...prev,
      [messageId]: prev[messageId] === type ? undefined : type,
    }));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, type, content }),
      });
    } catch (e) { }
  };

  const speak = (text: string) => {
    if (typeof window === 'undefined') return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'pt-PT';
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.lang?.toLowerCase().startsWith('pt') &&
        (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('microsoft'))
      );
      const fallback = voices.find(v => v.lang?.toLowerCase().startsWith('pt'));
      utter.voice = preferred || fallback || null;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleComment = async (messageId: string, content: string, comment: string) => {
    try {
      await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content, comment }),
      });
      await fetch('/api/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: comment }),
      });
    } catch (e) { }
  };

  const insertEmoji = (emoji: string) => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(newValue);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleToggleRecord = () => {
    handleFirstInteraction();
    if (voiceModalMode === 'ready-to-record') {
      startRecording();
    } else if (voiceModalMode === 'recording') {
      stopRecording();
    }
  };

  const startRecording = async () => {
    console.log('startRecording called');
    if (typeof window === 'undefined') return;
    try {
      setVoiceError(null);
      setVoiceModalMode('recording');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        handleAudioSubmit(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Recording error:', err);
      setVoiceModalMode('ready-to-record');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setVoiceError('Permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone nas configurações do seu navegador.');
        } else {
          setVoiceError('Erro ao acessar o microfone. Por favor, verifique se seu dispositivo tem um microfone e se as permissões estão corretas.');
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setVoiceModalMode('thinking');
      mediaRecorderRef.current.stop();
    }
  };

  const handleVoiceModalClose = () => {
    setVoiceModalOpen(false);
    setVoiceModalMode('ai-speaking');
    setVoiceMode('idle');
    setVoiceError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleAudioSubmit = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.text) {
        const userMsg = {
          id: 'user-' + Date.now(),
          content: data.text,
          user: 'me' as 'me',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);
        try {
          const res = await fetch('/api/chatgpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message: data.text,
              messages: [
                { role: 'user', content: data.text }
              ],
              language
            }),
          });
          const aiData = await res.json();
          
          // Atualiza o idioma atual se um novo idioma foi detectado
          if (aiData.detectedLanguage && aiData.detectedLanguage !== language) {
            setLanguage(aiData.detectedLanguage);
          }
          
          setMessages((prev) => [
            ...prev,
            {
              id: 'bot-' + Date.now(),
              content: aiData.reply || t('chat.fallback'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
          if (aiData.reply) {
            playTTS(aiData.reply, 'bot-' + Date.now(), () => {
              setVoiceModalOpen(false);
              setVoiceModalMode('ready-to-record');
            });
          } else {
            setVoiceModalOpen(false);
            setVoiceModalMode('ready-to-record');
          }
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              id: 'bot-error-' + Date.now(),
              content: t('common.error'),
              user: 'bot',
              created_at: new Date().toISOString(),
            },
          ]);
          setVoiceModalOpen(false);
          setVoiceModalMode('ready-to-record');
        } finally {
          setLoading(false);
          setIsTyping(false);
        }
      } else {
        setVoiceModalOpen(false);
        setVoiceModalMode('ready-to-record');
        setIsTyping(false);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setVoiceModalOpen(false);
      setVoiceModalMode('ready-to-record');
      setIsTyping(false);
    }
  };

  const handlePaperclipClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageButtonClick = () => {
    setImageText(newMessage);
    setImageModalOpen(true);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
    // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageModalClose = () => {
    setNewMessage(imageText);
    setImageModalOpen(false);
    setUploadedImage(null);
    setImagePreview(null);
    setImageText('');
    // Limpa o valor do input ao fechar o modal
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageConfirm = async () => {
    if (!uploadedImage) return;
    handleFirstInteraction();
    setLoading(true);
    setIsTyping(true);
    setImageModalOpen(false);

    // Extrai plataforma e tópico do texto fornecido
    const platform = selectedPlatform || extractPlatform(imageText);
    const topic = postTopic || extractTopic(imageText, platform);

    if (platform) {
      setSelectedPlatform(platform);
    }
    if (topic) {
      setPostTopic(topic);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: 'user-img-' + Date.now(),
        content: imageText,
        user: 'me',
        created_at: new Date().toISOString(),
        image: imagePreview,
      } as any,
    ]);

    let description = '';
    try {
      console.log('Sending image for analysis...');
      const formData = new FormData();
      formData.append('image', uploadedImage);
      formData.append('language', language);
      formData.append('context', imageText);
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Image analysis failed:', {
          status: res.status,
          statusText: res.statusText,
          error: data.error,
          details: data.details
        });
        throw new Error(data.error || 'Failed to analyze image');
      }

      if (!data.description) {
        console.error('No description in response:', data);
        throw new Error('No description received from image analysis');
      }

      description = data.description;
      setImageDescription(description);
      console.log('Image analysis successful');
    } catch (err) {
      console.error('Image analysis error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot-error-' + Date.now(),
          content: err instanceof Error ? err.message : t('common.error'),
          user: 'bot',
          created_at: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      setIsTyping(false);
      setUploadedImage(null);
      setImagePreview(null);
      return;
    }

    if (platform && topic) {
      const prompt = generatePostPrompt(platform, topic, description, imageText);
      try {
        console.log('Generating post for platform:', platform);
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, language }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('Post generation failed:', {
            status: res.status,
            statusText: res.statusText,
            error: data.error,
            details: data.details
          });
          throw new Error(data.error || 'Failed to generate post');
        }

        if (!data.reply) {
          console.error('No reply in response:', data);
          throw new Error('No response received from AI');
        }

        console.log('Post generation successful');
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply,
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
        setImageDescription(null);
      } catch (err) {
        console.error('AI response error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: err instanceof Error ? err.message : t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
        setUploadedImage(null);
        setImagePreview(null);
        setImageText('');
      }
    } else if (platform) {
      const followupPrompt = generateFollowupPrompt('topic', platform, undefined, imageText, description);
      try {
        console.log('Generating topic question...');
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followupPrompt, language }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('Question generation failed:', {
            status: res.status,
            statusText: res.statusText,
            error: data.error,
            details: data.details
          });
          throw new Error(data.error || 'Failed to generate follow-up question');
        }

        if (!data.reply) {
          console.error('No reply in response:', data);
          throw new Error('No response received from AI');
        }

        console.log('Question generation successful');
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply,
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error('AI response error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: err instanceof Error ? err.message : t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
        setUploadedImage(null);
        setImagePreview(null);
        setImageText('');
      }
    } else {
      const followupPrompt = generateFollowupPrompt('platform', undefined, undefined, imageText, description);
      try {
        console.log('Generating platform question...');
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followupPrompt, language }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('Question generation failed:', {
            status: res.status,
            statusText: res.statusText,
            error: data.error,
            details: data.details
          });
          throw new Error(data.error || 'Failed to generate follow-up question');
        }

        if (!data.reply) {
          console.error('No reply in response:', data);
          throw new Error('No response received from AI');
        }

        console.log('Question generation successful');
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply,
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error('AI response error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: err instanceof Error ? err.message : t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
        setUploadedImage(null);
        setImagePreview(null);
        setImageText('');
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].user === 'bot') {
      const typeSpeed = 50;
      const startDelay = 100;
      const msg = messages[messages.length - 1].content || '';
      setIsTypewriterActive(true);

      // Desativa o typewriter imediatamente após a resposta
      const timeout = setTimeout(() => {
        setIsTypewriterActive(false);
        setShouldAutoScroll(true);
        setUserScrolled(false);
      }, startDelay); // Removido o cálculo baseado no tamanho da mensagem

      return () => clearTimeout(timeout);
    }
  }, [messages]);

  const handleTooltipClick = async (tooltip: string) => {
    handleFirstInteraction();
    if (!user) return;
    const userMsg: Message = {
      id: 'user-' + Date.now(),
      content: tooltip,
      user: 'me',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setIsTyping(true);

    let platform = selectedPlatform || extractPlatform(tooltip);
    let topic = postTopic || extractTopic(tooltip, platform);
    
    // If we found a platform in the tooltip but no topic, try to extract topic from the tooltip
    if (platform && !topic) {
      topic = extractTopic(tooltip, platform);
    }
    
    // Update state based on what we found
    if (platform) {
      setSelectedPlatform(platform);
    }
    if (topic) {
      setPostTopic(topic);
    }

    if (platform && topic) {
      const prompt = generatePostPrompt(platform, topic);
      const openaiMessages = [
        { role: 'system', content: prompt },
        ...messages.map((msg) => ({
          role: msg.user === 'me' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: tooltip }
      ];
      try {
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: openaiMessages, language }),
        });
        const data = await res.json();
        
        // Atualiza o idioma atual se um novo idioma foi detectado
        if (data.detectedLanguage && data.detectedLanguage !== language) {
          setLanguage(data.detectedLanguage);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply || t('chat.fallback'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
      return;
    }

    if (!platform && tooltip.trim()) {
      setPostTopic(tooltip);
      const followupPrompt = generateFollowupPrompt('platform', undefined, tooltip);
      try {
        const res = await fetch('/api/chatgpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: followupPrompt, language }),
        });
        const data = await res.json();
        
        // Atualiza o idioma atual se um novo idioma foi detectado
        if (data.detectedLanguage && data.detectedLanguage !== language) {
          setLanguage(data.detectedLanguage);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            content: data.reply || t('chat.fallback'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-error-' + Date.now(),
            content: t('common.error'),
            user: 'bot',
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
      return;
    }

    // Fallback case - if none of the above conditions are met
    setLoading(false);
    setIsTyping(false);
  };

  const handleCopyContent = (content: string, messageId: string) => {
    try {
      const cleanedContent = copyMessageContent(content);

      if (!cleanedContent) {
        throw new Error('Conteúdo inválido para cópia');
      }

      navigator.clipboard.writeText(cleanedContent)
        .then(() => {
          notify.success(t('chat.copied'));
          setCopiedMessageId(messageId);
          // Reset o estado após 2 segundos
          setTimeout(() => {
            setCopiedMessageId(null);
          }, 2000);
        })
        .catch(err => {
          console.error('Erro ao copiar:', err);
          notify.error(t('common.error'));
        });
    } catch (err) {
      console.error('Erro ao processar conteúdo:', err);
      notify.error(t('common.error'));
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageViewerOpen(true);
  };

  const handleImageViewerClose = () => {
    setImageViewerOpen(false);
    setSelectedImage(null);
  };

  useEffect(() => {
    // Atualiza o idioma quando o componente é montado
    setCurrentLanguage(getBrowserLanguage());
  }, []);

  if (!user) return null;

  return (
    <div className="bg-auth-gradient min-h-screen flex items-center justify-center">
      <Toaster />
      <div className="w-full h-screen md:h-[90vh] md:max-w-2xl flex flex-col rounded-none md:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">
        <header className="p-4 md:p-4 flex justify-between items-center relative border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors"
              aria-label={dark ? t('settings.lightMode') : t('settings.darkMode')}
            >
              {dark ? (
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-5 h-5 text-white'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M6.05 6.05L4.636 4.636' />
                  <circle cx='12' cy='12' r='5' fill='currentColor' />
                </svg>
              ) : (
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-5 h-5 text-gray-900'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z' />
                </svg>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors"
              aria-label={t('auth.signOut') || 'Sair'}
            >
              <IoLogOutOutline className="w-5 h-5" />
            </button>
          </div>
          <a
            href="https://wa.me/351966915976"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:text-green-500 dark:hover:text-green-400 text-gray-900 dark:text-gray-300 transition-colors duration-200"
          >
            <FaWhatsapp className="w-5 h-5" />
            <span className="text-sm font-medium">+351 966 915 976</span>
          </a>
        </header>
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 px-6 py-4 overflow-y-auto custom-scrollbar relative">
          {greetingLoading ? (
            <div className="flex justify-center items-center py-8">
              <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></span>
              <span className="ml-3 text-gray-600 dark:text-gray-300">{t('chat.greetingLoading')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.user === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Mensagem do bot para o usuário */}
                  {msg.user === 'bot' && (
                    <div className="flex flex-col items-end mr-2 justify-center">
                      <FaRobot className="text-3xl text-gray-900 dark:text-gray-300" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl p-4 border-[0.5px] border-gray-200 dark:border-white text-gray-900 dark:text-white bg-transparent max-w-[90%] md:max-w-[90%] min-w-[100px] text-base relative group ${msg.user === 'me' ? 'ml-2' : 'mr-2'}`}
                  >
                    {/* Mensagem do usuário para o bot */}
                    <div className="flex flex-col gap-2 mb-4">
                      {msg.user === 'me' && msg.image ? (
                        <div className="flex flex-col items-center" style={{ width: '100%' }}>
                          <div className="max-w-xs w-full">
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2">
                              <img
                                src={msg.image}
                                alt="User upload"
                                className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleImageClick(msg.image!)}
                                style={{ maxHeight: '300px' }}
                              />
                            </div>
                            <div className="break-words w-full block" style={{ wordBreak: 'break-word' }}>
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      )}
                    </div>

                    {/* Botão de feedback e reprodução de audio */}
                    <div className="flex items-center gap-2 mt-5 pb-1 relative justify-between">
                      <div className="flex items-center gap-2">
                        {msg.user === 'bot' && (
                          <>
                            <button
                              className={`transition-colors ${feedback[msg.id] === 'like' ? 'text-green-400' : 'text-gray-900 dark:text-white'} hover:text-green-400 dark:hover:text-green-400`}
                              onClick={() => handleFeedback(msg.id, 'like', msg.content)}
                            >
                              <FaRegThumbsUp className="text-lg" />
                            </button>
                            <button
                              className={`transition-colors ${feedback[msg.id] === 'dislike' ? 'text-red-400' : 'text-gray-900 dark:text-white'} hover:text-red-400 dark:hover:text-red-400`}
                              onClick={() => handleFeedback(msg.id, 'dislike', msg.content)}
                            >
                              <FaRegThumbsDown className="text-lg" />
                            </button>
                            <button
                              className={`transition-colors relative group text-gray-900 dark:text-white`}
                              onClick={async () => {
                                if (currentAudioId === msg.id && isPlaying) {
                                  if (audioRef.current) {
                                    audioRef.current.pause();
                                  }
                                } else {
                                  await playTTS(msg.content, msg.id);
                                }
                              }}
                              disabled={ttsLoadingMsgId === msg.id}
                            >
                              {ttsLoadingMsgId === msg.id ? (
                                <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 inline-block"></span>
                              ) : (
                                <>
                                  {currentAudioId === msg.id ? (
                                    isPlaying ? (
                                      <FaPause className="text-lg" />
                                    ) : (
                                      <FaPlay className="text-lg" />
                                    )
                                  ) : (
                                    <FaVolumeUp className="text-lg" />
                                  )}

                                  {/* Barra de reprodução de audio */}
                                  {currentAudioId === msg.id && (
                                    <div className="absolute -bottom-1.3 mt-1 left-0 w-full h-0.5 bg-gray-300 dark:bg-white/20">
                                      <div
                                        className="absolute bottom-0 z-10 h-full bg-blue-400 mt-1 transition-all duration-100"
                                        style={{ width: `${audioProgress}%` }}
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </button>
                            <button className="transition-colors text-gray-900 dark:text-white" onClick={() => setCommentModal({ open: true, message: { id: msg.id, content: msg.content } })}><FaRegCommentDots className="text-lg" /></button>
                            {isPostResponse(msg.content) && (
                              <button
                                className="hover:text-blue-500 dark:hover:text-blue-300 transition-colors relative group text-gray-900 dark:text-white"
                                onClick={() => handleCopyContent(msg.content, msg.id)}
                                title={t('chat.copy') || 'Copiar'}
                              >
                                {copiedMessageId === msg.id ? (
                                  <div className="flex flex-col items-center">
                                    <FaCheck className="text-lg text-green-400" />
                                    <span className="text-xs text-green-400 mt-1">{t('chat.copied')}</span>
                                  </div>
                                ) : (
                                  <FaCopy className="text-lg" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-xs opacity-60 whitespace-nowrap">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {msg.user === 'me' && (
                    <div className="flex flex-col items-end ml-2 justify-center">
                      <FaUserCircle className="text-3xl text-gray-900 dark:text-gray-300" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex flex-col items-end mr-2 justify-center">
                    <FaRobot className="text-3xl text-gray-900 dark:text-gray-300" />
                  </div>
                  <div className="rounded-xl p-4 border border-gray-200 dark:border-white/30 text-gray-900 dark:text-white bg-white dark:bg-transparent max-w-[98%] md:max-w-[90%] min-w-[100px] text-base relative group mr-2">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {!isNearBottom && showScrollButton && !imageViewerOpen && (
                <button
                  onClick={scrollToBottom}
                  className="fixed bottom-24 right-2 md:right-auto md:left-1/2 md:transform md:-translate-x-1/2 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 z-50"
                  aria-label="Scroll to bottom"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                  </svg>
                </button>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>
        {showTooltips && tooltips.length > 0 && (
          <div className="w-full px-6">
            <div className="w-full border-t border-gray-200 dark:border-gray-700 mb-4" />
            <div className="flex flex-col gap-2 mb-2 items-center w-full md:hidden">
              <button
                className="w-full flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-white text-gray-700 dark:text-gray-900 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 ease-in-out text-center"
                onClick={() => setShowTooltipsModal(true)}
              >
                Sugestões
              </button>
            </div>
            <div className="hidden md:flex flex-col gap-2 mb-4 items-center w-full">
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                {tooltips.slice(0, 2).map((tip, idx) => (
                  <button
                    key={idx}
                    className="flex-1 px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-white text-gray-700 dark:text-gray-900 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 ease-in-out"
                    onClick={() => handleTooltipClick(tip)}
                  >
                    {tip}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                {tooltips.slice(2, 4).map((tip, idx) => (
                  <button
                    key={idx + 2}
                    className="flex-1 px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-white text-gray-700 dark:text-gray-900 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 ease-in-out"
                    onClick={() => handleTooltipClick(tip)}
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
            {showTooltipsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-gray-200 dark:bg-white/20 rounded-2xl shadow-2xl p-6 max-w-xs w-full flex flex-col items-center border border-gray-200 dark:border-white/30 backdrop-blur-md relative">
                  <button
                    className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
                    onClick={() => setShowTooltipsModal(false)}
                    aria-label="Close"
                    type="button"
                  >
                    &times;
                  </button>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Sugestões</h2>
                  <div className="flex flex-col gap-3 w-full">
                    {tooltips.slice(0, 4).map((tip, idx) => (
                      <button
                        key={idx}
                        className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-white text-gray-700 dark:text-gray-900 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 ease-in-out text-center"
                        onClick={() => { handleTooltipClick(tip); setShowTooltipsModal(false); }}
                      >
                        {tip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <footer className="w-full p-3">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 bg-white dark:bg-transparent rounded-2xl px-4 py-2 shadow-md border border-gray-200 dark:border-gray-600 relative"
          >
            <div className="flex items-center w-full">
              <button
                ref={emojiButtonRef}
                type="button"
                className="hidden md:inline-flex p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors mr-2"
                onClick={() => setShowEmojiPicker((v) => !v)}
                tabIndex={-1}
              >
                <FaRegSmile className="text-xl" />
              </button>
              <textarea
                ref={inputRef}
                placeholder={t('chat.typeMessage')}
                className="flex-1 bg-transparent outline-none px-2 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newMessage.trim() && !loading) {
                      handleSendMessage(e);
                    }
                  }
                }}
                disabled={loading}
                style={{ background: 'transparent', minHeight: '40px', maxHeight: '120px' }}
                rows={1}
              />
              <button
                type="submit"
                className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors disabled:opacity-50 ml-2"
                disabled={!newMessage.trim() || loading}
              >
                <FaPaperPlane className="text-xl" />
              </button>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors ml-2"
                onClick={() => {
                  setVoiceModalOpen(true);
                  setVoiceModalMode('ready-to-record');
                }}
              >
                <FaMicrophone className="text-xl" />
              </button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-300 focus:outline-none transition-colors ml-2"
                onClick={handleImageButtonClick}
                title="Upload Image"
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 16.5z" />
                  <circle cx="8.25" cy="9.75" r="1.25" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.5l-5.25-5.25a2.25 2.25 0 00-3.182 0L3 21" />
                </svg>
              </button>
            </div>
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-12 left-0 z-50"
              >
                <EmojiPicker
                  data={data}
                  theme={dark ? 'dark' : 'light'}
                  onEmojiSelect={(e: any) => {
                    insertEmoji(e.native);
                  }}
                  previewPosition="none"
                />
              </div>
            )}
          </form>
          <div className="w-full px-6 mb-1 mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('chat.disclaimer')}</p>
          </div>
        </footer>
      </div>
      <CommentModal
        isOpen={commentModal.open}
        onClose={() => setCommentModal({ open: false })}
        onSubmit={(comment) => {
          if (commentModal.message) {
            handleComment(commentModal.message.id, commentModal.message.content, comment);
          }
        }}
      />

      {/* Modal de UploadImage  */}
      <Modal
        isOpen={imageModalOpen}
        onRequestClose={handleImageModalClose}
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
        ariaHideApp={false}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        closeTimeoutMS={200}
        onOverlayClick={handleImageModalClose}
        overlayElement={(props: React.HTMLAttributes<HTMLDivElement>, contentElement: React.ReactNode) => (
          <div {...props} onClick={handleImageModalClose}>
            {contentElement}
          </div>
        )}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 flex flex-col items-center gap-4 w-[90vw] max-w-md border border-gray-200 dark:border-gray-700 shadow-2xl transform transition-all duration-200 ease-in-out"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full mb-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">{t('chat.uploadImage') || 'Upload de Imagem'}</h2>
            <button
              onClick={handleImageModalClose}
              className="absolute top-0 right-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('common.cancel') || 'Fechar'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div
            className={`w-full h-48 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 ${imagePreview
              ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            onDrop={handleImageDrop}
            onDragOver={e => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            {imagePreview ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-44 max-w-full object-contain rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                  aria-label={t('common.delete') || 'Remover imagem'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 16.5z" />
                  <circle cx="8.25" cy="9.75" r="1.25" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.5l-5.25-5.25a2.25 2.25 0 00-3.182 0L3 21" />
                </svg>
                <span className="text-center px-4">{t('chat.dragAndDropImage') || 'Arraste e solte ou clique para selecionar uma imagem'}</span>
              </div>
            )}
          </div>
          <div className="w-full">
            <div className="flex items-center w-full bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2 shadow-md border border-gray-200 dark:border-gray-600">
              <input
                type="text"
                placeholder={t('chat.typeMessage') || 'Digite uma mensagem para a imagem...'}
                className="flex-1 bg-transparent outline-none px-2 py-2 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-300"
                value={imageText}
                onChange={(e) => setImageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && uploadedImage) {
                    e.preventDefault();
                    handleImageConfirm();
                  }
                }}
                style={{ background: 'transparent' }}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4 w-full">
            <button
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                handleImageConfirm();
              }}
              disabled={!uploadedImage}
            >
              {t('common.confirm') || 'Confirmar'}
            </button>
            <button
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-semibold transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleImageModalClose();
              }}
            >
              {t('common.cancel') || 'Cancelar'}
            </button>
          </div>
        </div>
      </Modal>
      <VoiceModal
        isOpen={voiceModalOpen && (voiceModalMode === 'ready-to-record' || voiceModalMode === 'recording')}
        onClose={handleVoiceModalClose}
        onSubmit={handleAudioSubmit}
        mode={voiceModalMode}
        onToggleRecord={handleToggleRecord}
        modalRef={voiceModalRef}
        error={voiceError}
      />

      {/* Modal de Visualização de Imagem */}
      <Modal
        isOpen={imageViewerOpen}
        onRequestClose={handleImageViewerClose}
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
        ariaHideApp={false}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        closeTimeoutMS={0}
        onOverlayClick={handleImageViewerClose}
      >
        <div
          className="relative bg-white dark:bg-gray-800 rounded-2xl p-4 max-w-2xl w-[90vw] border border-gray-200 dark:border-gray-700 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('chat.imagePreview') || 'Visualização da Imagem'}</h2>
            <button
              onClick={handleImageViewerClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('common.close') || 'Fechar'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {selectedImage && (
            <div className="relative w-full aspect-square md:aspect-auto md:h-[60vh] bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
              <img
                src={selectedImage}
                alt="Full size"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleImageViewerClose}
              className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
            >
              {t('common.close') || 'Fechar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChatComponent; 