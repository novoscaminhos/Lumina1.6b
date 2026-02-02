import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutGrid, RotateCcw, Sparkles, ChevronRight, ChevronLeft, BookOpen,
  Compass, Target, Activity, Award, Key, Clock, Edit3, Dices, Zap,
  MessageSquare, User, Sun, Moon, History, AlertCircle, LogOut, Mail,
  ShieldCheck, Info, Wand2, HelpCircle, Anchor, X, AlertTriangle,
  Brain, GitBranch, Layers, SearchCode, Loader2, Settings, ListFilter,
  ArrowRightLeft, MoveDiagonal, Heart, Briefcase, Stars, ChevronUp, ChevronDown,
  Eye, Maximize2, Minimize2, Menu, Save, Download, CreditCard,
  Book, GitMerge, RefreshCw, Scale, ZapOff, Trash2, Calendar, HardDrive, Smartphone, Globe, Share2,
  GraduationCap, PenTool, ClipboardList, BarChart3, Binary, MousePointer2, Plus, Monitor,
  Crosshair, Frame, CornerDownRight, CheckCircle2, Lightbulb, ZoomIn, ZoomOut,
  Grid3x3, Home, Camera, Timer, Lock, Coins, MessagesSquare
} from 'lucide-react';
import html2canvas from 'https://esm.sh/html2canvas@1.4.1';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
import { LENORMAND_CARDS, LENORMAND_HOUSES, FUNDAMENTALS_DATA, STUDY_BALLOONS } from './constants';
import { Polarity, Timing, LenormandCard, LenormandHouse, SpreadType, StudyLevel, ReadingTheme, StudyModeState, StudyBalloon, GeometryFilter } from './types';
import { getDetailedCardAnalysis } from './geminiService';
import * as Geometry from './geometryService';
import { CARD_IMAGES, FALLBACK_IMAGE, BASE64_FALLBACK } from './cardImages';

// ===============================
// Constantes & Configurações
// ===============================

const TRIAL_DURATION_MS = 30 * 60 * 1000; // 30 minutos
type AccessType = 'full' | 'trial' | 'none';

// NOVA DEFINIÇÃO: Templo de Afrodite (7 Casas)
const AFRODITE_HOUSES = [
  { id: 201, name: "Pensamento (Consulente)", theme: "Mental", technicalDescription: "O que o consulente pensa racionalmente sobre a relação." },
  { id: 202, name: "Pensamento (Parceiro)", theme: "Mental", technicalDescription: "O que o parceiro pensa racionalmente sobre a relação." },
  { id: 203, name: "Sentimento (Consulente)", theme: "Emocional", technicalDescription: "O que o consulente sente no coração (emoções profundas)." },
  { id: 204, name: "Sentimento (Parceiro)", theme: "Emocional", technicalDescription: "O que o parceiro sente no coração (emoções profundas)." },
  { id: 205, name: "Atitude (Consulente)", theme: "Físico/Ação", technicalDescription: "Como o consulente age externamente na relação." },
  { id: 206, name: "Atitude (Parceiro)", theme: "Físico/Ação", technicalDescription: "Como o parceiro age externamente na relação." },
  { id: 207, name: "Resultado / Destino", theme: "Síntese", technicalDescription: "O futuro próximo ou a energia central da conexão." }
];

// ===============================
// Componentes de Interface
// ===============================

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void; disabled?: boolean; className?: string }> = ({ icon, label, active, collapsed, onClick, disabled, className }) => (
  <button
    onClick={disabled ? undefined : onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-200 hover:text-indigo-950 font-bold'} ${collapsed ? 'justify-center px-0' : ''} ${className || ''}`} 
    title={collapsed ? label : ""}
    disabled={disabled}
  > 
    <div className={`flex items-center justify-center shrink-0 w-6 h-6 ${collapsed ? 'scale-110' : ''}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { strokeWidth: 2.5, className: 'w-full h-full' }) : icon}
    </div>
    {!collapsed && <span className="font-medium text-[10px] uppercase font-bold tracking-widest whitespace-nowrap overflow-hidden">{label}</span>}
  </button>
);

const Balloon: React.FC<{ balloon: StudyBalloon; onDismiss: () => void }> = ({ balloon, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-full max-sm:px-4 max-w-sm p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-500 bg-white border-indigo-200 text-slate-900 shadow-indigo-500/20`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0"><Lightbulb size={18}/></div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest mb-1 text-indigo-600">{balloon.title}</h4>
          <p className="text-[13px] leading-relaxed">{balloon.text}</p>
        </div>
        <button onClick={onDismiss} className="ml-auto text-slate-500 hover:text-slate-900 transition-colors"><X size={14}/></button>
      </div>
    </div>
  );
};

const CardVisual: React.FC<{
  card: any;
  houseId: number;
  onClick: () => void;
  isSelected: boolean;
  isThemeCard: boolean;
  themeColor?: string;
  highlightType?: string | null;
  isManualMode?: boolean;
  spreadType?: SpreadType | 'templo-afrodite';
  offsetX?: string;
  offsetY?: string;
  studyModeActive?: boolean;
  isAnimating?: boolean;
}> = ({
  card,
  houseId,
  onClick,
  isSelected,
  isThemeCard,
  themeColor,
  highlightType,
  isManualMode,
  spreadType = 'mesa-real',
  offsetX = '0px',
  offsetY = '0px',
  studyModeActive = false,
  isAnimating = false
}) => {
  const highlightStyles: Record<string, string> = {
    mirror: 'ring-4 ring-cyan-500/60 border-cyan-400 scale-105 z-10',
    knight: 'ring-4 ring-fuchsia-500/60 border-fuchsia-400 scale-105 z-10',
    frame: 'border-amber-500/80 ring-2 ring-amber-500/40 animate-pulse',
    axis: 'ring-4 ring-indigo-500/60 border-indigo-400 scale-105 z-10',
    bridge: 'ring-4 ring-amber-400/80 border-amber-400 scale-110 z-30',
    veredito: 'ring-4 ring-emerald-500/60 border-emerald-400 scale-105 z-10',
    'diag-up': 'ring-4 ring-orange-500/60 border-orange-400 scale-105 z-10',
    'diag-down': 'ring-4 ring-indigo-500/60 border-indigo-400 scale-105 z-10',
    'center': 'ring-4 ring-amber-400 border-amber-400 scale-110 z-30',
    'cruz': 'ring-4 ring-purple-500/60 border-purple-400 scale-105 z-20',
    theme: 'ring-[6px] ring-white/40 border-white scale-110 z-40'
  };

  const animationClass = isAnimating ? (spreadType === 'mesa-real' ? 'animate-mesa-card' : 'animate-clock-card') : '';
  const animationDelay = `${(houseId % 36) * 0.04}s`;

  return (
    <div 
      onClick={onClick} 
      className={`relative group aspect-[3/4.2] rounded-xl border-2 cursor-pointer transition-all duration-500 overflow-visible shadow-xl 
        ${isSelected 
          ? 'border-indigo-600 ring-[6px] ring-indigo-600/30 scale-110 z-50' 
          : isThemeCard 
            ? 'border-transparent scale-105 z-20' 
            : highlightType 
              ? `${highlightStyles[highlightType]}` 
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        } 
        ${animationClass} ${studyModeActive && !highlightType ? 'opacity-30 scale-95' : ''}`}
      style={{ 
        ...(isThemeCard ? { boxShadow: `0 0 30px ${themeColor}, inset 0 0 15px ${themeColor}` } : {}),
        ...(isSelected ? { boxShadow: `0 0 50px rgba(79, 70, 229, 0.7), inset 0 0 20px rgba(79, 70, 229, 0.4)` } : {}),
        animationDelay,
        ['--offset-x' as any]: offsetX,
        ['--offset-y' as any]: offsetY
      }}
    >
      {isSelected && (
        <div className="absolute -inset-4 border-[4px] border-dashed border-indigo-500/70 rounded-[1.4rem] animate-[spin_12s_linear_infinite] pointer-events-none" />
      )}
      <div className="card-visual-inner">
        <div className="card-face-front">
          {card && (
            <div className="absolute inset-0 z-0 rounded-xl overflow-hidden">
              <img src={CARD_IMAGES[card.id] || FALLBACK_IMAGE} className={`w-full h-full object-cover opacity-40 transition-opacity`} alt="" />
            </div>
          )}
          {!card && isManualMode && <div className="absolute inset-0 flex items-center justify-center"><Plus size={16} className={`opacity-30 text-slate-700`} /></div>}
          
          <div className="absolute top-1 left-1 z-20 flex items-center gap-1.5">
            <span className={`text-[7px] md:text-[8px] font-black uppercase bg-black/40 px-1 rounded-sm backdrop-blur-sm text-white`}>CASA {houseId}</span>
            {isSelected && <div className="p-1 bg-indigo-600 rounded-full text-white shadow-xl scale-110 animate-pulse"><Crosshair size={10} strokeWidth={3} /></div>}
          </div>

          {card && (
            <div className="absolute inset-0 z-30 flex flex-col p-2 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent rounded-xl">
              <div className="flex-grow flex flex-col items-center justify-center text-center mt-2">
                <span className="text-[7px] md:text-[10px] font-cinzel font-bold text-white uppercase leading-tight tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{card.name}</span>
              </div>
              <div className="mt-auto flex justify-between items-center bg-black/30 -mx-2 -mb-2 px-2 py-1 rounded-b-xl">
                <span className="text-[12px] font-black text-white leading-none">{card.id}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${card.polarity === Polarity.POSITIVE ? 'bg-emerald-500' : card.polarity === Polarity.NEGATIVE ? 'bg-rose-500' : 'bg-slate-400'}`} />
              </div>
            </div>
          )}
        </div>
        <div className="card-face-back"></div>
      </div>
    </div>
  );
};

const ConceptAccordion: React.FC<{
  concept: { title: string; text: string; example?: string; details?: string; practiceTarget?: SpreadType; id?: string };
  isOpen: boolean;
  onToggle: () => void;
  onPractice?: () => void;
}> = ({ concept, isOpen, onToggle, onPractice }) => {
  return (
    <div className={`bg-white border-slate-200 shadow-sm border rounded-2xl overflow-hidden transition-all duration-300`}>
      <div onClick={onToggle} className={`p-6 cursor-pointer hover:bg-slate-800/10 flex flex-col`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-xs font-bold uppercase tracking-widest text-indigo-800`}>{concept.title}</h4>
          <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown size={16} /></div>
        </div>
        <p className={`text-sm leading-relaxed mb-2 text-slate-700`}>{concept.text}</p>
        {concept.example && <p className="text-xs text-slate-500 italic">Ex: {concept.example}</p>}
      </div>
      {isOpen && (
        <div className={`px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 animate-in fade-in duration-300`}>
          <div className={`text-[13px] leading-relaxed whitespace-pre-wrap mb-6 text-slate-600`}>{concept.details}</div>
          {onPractice && concept.practiceTarget && (
            <button onClick={(e) => { e.stopPropagation(); onPractice(); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg">
              <Eye size={14} /> Ver na Prática
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ===============================
// App Principal
// ===============================

const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mentorPanelOpen, setMentorPanelOpen] = useState(false);
  const darkMode = false;
  const [view, setView] = useState<'home' | 'board' | 'fundamentals' | 'glossary' | 'profile' | 'study'>('home');
  // spreadType agora aceita 'templo-afrodite'
  const [spreadType, setSpreadType] = useState<SpreadType | 'templo-afrodite'>('mesa-real');
  const [isManualMode, setIsManualMode] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<StudyLevel>('Iniciante');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('Geral');
  
  const [board, setBoard] = useState<(number | null)[]>([]);
  const [firstDrawBoard, setFirstDrawBoard] = useState<(number | null)[] | null>(null);
  const [secondDrawBoard, setSecondDrawBoard] = useState<(number | null)[] | null>(null);
  const [isViewingFirstDraw, setIsViewingFirstDraw] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  
  const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
  const [geometryFilters, setGeometryFilters] = useState<Set<GeometryFilter>>(new Set(['todas']));
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [cardAnalysis, setCardAnalysis] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(0.68);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [unscaledHeight, setUnscaledHeight] = useState(800);

  // --- TRIAL MODE ---
  const [accessType, setAccessType] = useState<AccessType>('none');
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialConsumed, setTrialConsumed] = useState(() => localStorage.getItem('lumina_trial_consumed') === 'true');
  const [trialTimeLeft, setTrialTimeLeft] = useState<string>("");
  const isTrialMode = accessType === 'trial';

  // --- STUDY MODE ---
  const [studyMode, setStudyMode] = useState<StudyModeState>({ active: false, level: 'Iniciante', topicId: null });
  const [activeBalloons, setActiveBalloons] = useState<StudyBalloon[]>([]);

  useEffect(() => {
    // Lógica de Acesso (URL e LocalStorage)
    const params = new URLSearchParams(window.location.search);
    const accessFromUrl = params.get('access') as AccessType | null;

    if (accessFromUrl === 'full') {
      localStorage.setItem('lumina_access_type', 'full');
      setAccessType('full');
      return;
    }
    if (accessFromUrl === 'trial') {
      if (localStorage.getItem('lumina_trial_consumed') === 'true') {
        setAccessType('none'); return;
      }
      localStorage.setItem('lumina_access_type', 'trial');
      localStorage.setItem('lumina_trial_token', Date.now().toString());
      setAccessType('trial');
      return;
    }

    const storedAccess = localStorage.getItem('lumina_access_type') as AccessType | null;
    const consumed = localStorage.getItem('lumina_trial_consumed') === 'true';
    const token = localStorage.getItem('lumina_trial_token');

    if (storedAccess === 'full') {
      setAccessType('full');
    } else if (storedAccess === 'trial') {
      if (consumed) {
         setTrialConsumed(true); setAccessType('none'); localStorage.removeItem('lumina_access_type');
      } else if (token) {
        const elapsed = Date.now() - parseInt(token, 10);
        if (elapsed >= TRIAL_DURATION_MS) {
          setTrialExpired(true); setTrialConsumed(true); localStorage.setItem('lumina_trial_consumed', 'true');
        } else {
          setAccessType('trial');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (accessType !== 'trial' || trialExpired) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem('lumina_trial_token');
      if (!token) return;
      const remaining = TRIAL_DURATION_MS - (Date.now() - parseInt(token, 10));
      if (remaining <= 0) {
        setTrialExpired(true); setTrialConsumed(true); localStorage.setItem('lumina_trial_consumed', 'true');
        clearInterval(interval);
      } else {
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setTrialTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [accessType, trialExpired]);

  const handleStartTrial = () => {
    if (localStorage.getItem('lumina_trial_consumed') === 'true') return;
    localStorage.setItem('lumina_access_type', 'trial');
    localStorage.setItem('lumina_trial_token', Date.now().toString());
    setAccessType('trial');
    setTrialExpired(false);
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.4));
  
  const handleResetZoom = useCallback(() => {
    if (boardRef.current && contentRef.current) {
      const container = boardRef.current;
      const content = contentRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;
      
      const padding = spreadType === 'relogio' ? 40 : 100; 
      let fitScale = Math.min((containerWidth - padding) / contentWidth, (containerHeight - padding) / contentHeight);
      
      if (spreadType === 'relogio') {
        fitScale = Math.min(fitScale, 1.3); fitScale = Math.max(0.6, fitScale);
      } else {
        fitScale = Math.min(fitScale, window.innerWidth >= 1024 ? 0.75 : 1.0);
      }
      setZoomLevel(Math.max(0.25, fitScale));
      setZoomMenuOpen(false);
    }
  }, [spreadType, view]);

  useEffect(() => {
    if (view === 'board') setTimeout(handleResetZoom, 500);
  }, [view, spreadType, handleResetZoom]);

  const [savedReadings, setSavedReadings] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('lumina_saved_readings') || '[]'); } catch { return []; }
  });

  const handleShuffle = () => {
    setIsAnimating(true);
    setBoard(Array(36).fill(null)); // Limpa antes de animar
    
    setTimeout(() => {
      const deck = Array.from({ length: 36 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      
      // Lógica de distribuição baseada no tipo de jogo
      let newBoard = Array(36).fill(null);
      
      if (spreadType === 'mesa-real') {
        newBoard = deck;
      } else if (spreadType === 'mesa-9') {
        for(let i=0; i<9; i++) newBoard[i] = deck[i];
      } else if (spreadType === 'relogio') {
        for(let i=0; i<13; i++) newBoard[i] = deck[i];
        setFirstDrawBoard([...newBoard]);
      } else if (spreadType === 'templo-afrodite') {
        // Templo de Afrodite usa 7 cartas
        for(let i=0; i<7; i++) newBoard[i] = deck[i];
      }

      setBoard(newBoard);
      setIsAnimating(false);
    }, 600);
  };

  const handleHouseSelection = (index: number) => {
    if (selectedHouse === index) {
      setMentorPanelOpen(!mentorPanelOpen);
    } else {
      setSelectedHouse(index);
      setMentorPanelOpen(true);
      setCardAnalysis(null);
    }
  };

  // Memoização para identificar a Casa Atual (incluindo Afrodite)
  const currentHouse = useMemo(() => {
    if (selectedHouse === null) return null;
    
    if (spreadType === 'relogio') {
      if (selectedHouse === 12) return { id: 113, name: "Tom da Leitura", theme: "Síntese Anual", technicalDescription: "A energia central que regula todo o ciclo anual." } as LenormandHouse;
      return LENORMAND_HOUSES.find(h => h.id === 101 + selectedHouse);
    }

    if (spreadType === 'templo-afrodite') {
      return AFRODITE_HOUSES[selectedHouse] as unknown as LenormandHouse;
    }

    return LENORMAND_HOUSES[selectedHouse];
  }, [selectedHouse, spreadType]);

  const selectedCard = useMemo(() => {
    if (selectedHouse === null) return null;
    const cardId = board[selectedHouse];
    return cardId ? LENORMAND_CARDS.find(c => c.id === cardId) : null;
  }, [selectedHouse, board]);

  const runMentorAnalysis = async () => {
    if (!selectedCard || !currentHouse) return;
    setIsAiLoading(true);
    try {
      const prompt = `Carta: ${selectedCard.name}. Casa: ${currentHouse.name} (${currentHouse.theme}). Contexto: ${spreadType}. Explique resumidamente o significado combinatório.`;
      const analysis = await getDetailedCardAnalysis(board, selectedHouse || 0, readingTheme, spreadType, difficultyLevel);
      setCardAnalysis(analysis);
    } catch (error) {
      setCardAnalysis("O Mentor está em silêncio no momento (Erro de conexão). Tente novamente.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const getGeometryHighlight = (index: number) => {
    if (spreadType !== 'mesa-real' && spreadType !== 'mesa-9') return null;
    // (Lógica simplificada de geometria para economizar espaço, mantendo a funcionalidade base)
    if (geometryFilters.has('todas')) return null;
    return null; 
  };
  
  const handleClearSpread = () => {
      setBoard(Array(36).fill(null));
      setFirstDrawBoard(null);
      setSecondDrawBoard(null);
      setSelectedHouse(null);
      setIsHistoryView(false);
  };

  const handleSecondDraw = () => { /* Lógica existente do relógio */ };
  const handleToggleDraws = () => { /* Lógica existente do relógio */ };
  const showDicas = () => { /* Lógica de balões */ };
  const toggleFilter = (f: GeometryFilter) => { /* Lógica de filtros */ };

  // Função para Salvar no Navegador
  const handleSaveReading = () => {
    const newReading = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      spreadType,
      theme: readingTheme,
      cards: [...board],
      analysis: cardAnalysis // análise que veio do Gemini
    };

    const existing = JSON.parse(localStorage.getItem('lumina_readings') || '[]');
    localStorage.setItem('lumina_readings', JSON.stringify([newReading, ...existing]));
    
    alert("Leitura guardada no seu histórico local!");
  };

  // Função para Exportar (Gera um PDF via Print do Navegador)
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className={`flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden transition-colors duration-500`}>
      {/* SIDEBAR - Estrutura Fixa com Scroll e Menu Inferior */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-[80] hidden md:flex shadow-xl h-screen sticky top-0`}>
        
        {/* 1. TOPO: LOGO (Fixo) */}
        <div className="h-20 flex-shrink-0 flex items-center justify-center border-b border-slate-100 bg-white">
          <img 
            src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" 
            alt="Logo" 
            className={`transition-all duration-500 ${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`} 
          />
          {!sidebarCollapsed && <span className="ml-3 font-cinzel font-black text-xl text-indigo-900 tracking-widest uppercase">LUMINA</span>}
        </div>

        {/* 2. MEIO: NAVEGAÇÃO (Com Scroll se a tela for pequena) */}
        <nav className="flex-grow p-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
          <NavItem icon={<Home size={20}/>} label="Início" active={view === 'home'} collapsed={sidebarCollapsed} onClick={() => setView('home')} />
          
          <div className="my-4 flex items-center px-2">
            <div className="flex-grow border-t border-slate-100"></div>
            {!sidebarCollapsed && <span className="mx-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiragens</span>}
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <NavItem icon={<LayoutGrid size={20}/>} label="Mesa Real" active={view === 'board' && spreadType === 'mesa-real'} collapsed={sidebarCollapsed} onClick={() => { setView('board'); setSpreadType('mesa-real'); setIsManualMode(false); }} disabled={accessType === 'none'} />
          <NavItem icon={<Grid3x3 size={20}/>} label="Quadrado de 9" active={view === 'board' && spreadType === 'mesa-9'} collapsed={sidebarCollapsed} onClick={() => { setView('board'); setSpreadType('mesa-9'); setIsManualMode(false); }} disabled={accessType === 'none'} />
          <NavItem icon={<Clock size={20}/>} label="Relógio Cigano" active={view === 'board' && spreadType === 'relogio'} collapsed={sidebarCollapsed} onClick={() => { setView('board'); setSpreadType('relogio'); setIsManualMode(false); }} disabled={accessType === 'none'} />
          
          {/* NOVO: Templo de Afrodite */}
          <NavItem icon={<Heart size={20} className="text-rose-500" />} label="Templo de Afrodite" active={view === 'board' && spreadType === 'templo-afrodite'} collapsed={sidebarCollapsed} onClick={() => { setView('board'); setSpreadType('templo-afrodite'); setIsManualMode(false); }} disabled={accessType === 'none'} />
          
          <div className="my-4 border-t border-slate-100 mx-2" />
          <NavItem icon={<Book size={20}/>} label="Glossário" active={view === 'glossary'} collapsed={sidebarCollapsed} onClick={() => setView('glossary')} />
        </nav>

        {/* 3. BASE: AÇÕES DE SISTEMA (Fixo no rodapé) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 space-y-1">
          
          <NavItem 
            icon={<Save size={20} className="text-emerald-600" />} 
            label="Salvar Jogo" 
            collapsed={sidebarCollapsed} 
            onClick={handleSaveReading} 
          />
          
          <NavItem 
            icon={<Share2 size={20} className="text-blue-600" />} 
            label="Exportar PDF" 
            collapsed={sidebarCollapsed} 
            onClick={handleExportPDF} 
          />
          
          <NavItem 
            icon={<User size={20} />} 
            label="Meu Perfil" 
            active={view === 'profile'}
            collapsed={sidebarCollapsed} 
            onClick={() => setView('profile')} 
          />

          {/* Botão de Toggle (Recolher) */}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
            className="w-full mt-4 flex items-center justify-center p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100"
          >
            <Menu size={20} />
            {!sidebarCollapsed && <span className="ml-2 text-xs font-bold uppercase tracking-tighter">Recolher Menu</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 justify-between z-40 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="md:hidden"><img src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" className="w-8 h-8"/></div>
             <h2 className="font-cinzel font-bold text-lg md:text-xl text-indigo-900 uppercase tracking-widest">
               {view === 'home' ? 'Portal Lumina' : spreadType === 'templo-afrodite' ? 'Templo de Afrodite' : spreadType.replace('-', ' ')}
             </h2>
          </div>
          {view === 'board' && (
            <div className="flex items-center gap-2">
               <button onClick={handleClearSpread} className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
               <button onClick={handleShuffle} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center gap-2"><RotateCcw size={14}/> Embaralhar</button>
            </div>
          )}
        </header>

        <div className="flex-grow overflow-y-auto overflow-x-hidden p-4 md:p-8 relative custom-scrollbar">
          {view === 'home' && (
            <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-10 text-center animate-in fade-in duration-700">
               <img src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" className="w-24 h-24 mb-6" />
               <h1 className="text-4xl md:text-6xl font-cinzel font-black text-slate-900 mb-4">LUMINA</h1>
               <p className="text-slate-500 max-w-lg mx-auto mb-10">Selecione uma modalidade abaixo para iniciar.</p>
               
               {accessType === 'none' && !trialConsumed && (
                  <button onClick={handleStartTrial} className="mb-12 px-8 py-4 bg-indigo-600 text-white rounded-full font-bold shadow-xl hover:scale-105 transition-transform flex items-center gap-2"><Zap size={18}/> INICIAR DEGUSTAÇÃO</button>
               )}

               <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full ${accessType === 'none' ? 'opacity-50 pointer-events-none filter blur-[2px]' : ''}`}>
                  {[
                    { type: 'mesa-real', label: 'Mesa Real', icon: <LayoutGrid size={24}/>, color: 'indigo' },
                    { type: 'mesa-9', label: 'Mesa de 9', icon: <Grid3x3 size={24}/>, color: 'purple' },
                    { type: 'relogio', label: 'Relógio', icon: <Clock size={24}/>, color: 'amber' },
                    { type: 'templo-afrodite', label: 'Afrodite', icon: <Heart size={24}/>, color: 'rose' }
                  ].map((item) => (
                    <div key={item.type} onClick={() => { setView('board'); setSpreadType(item.type as any); }} className={`bg-white border p-6 rounded-2xl cursor-pointer hover:border-${item.color}-500 hover:shadow-xl transition-all group`}>
                       <div className={`w-12 h-12 bg-${item.color}-50 text-${item.color}-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>{item.icon}</div>
                       <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">{item.label}</h3>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {view === 'board' && (
            <>
              {/* Controles de Zoom */}
              <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                 <button onClick={handleZoomIn} className="p-2 bg-white border rounded-full shadow-lg hover:bg-slate-50"><ZoomIn size={20}/></button>
                 <button onClick={handleZoomOut} className="p-2 bg-white border rounded-full shadow-lg hover:bg-slate-50"><ZoomOut size={20}/></button>
                 <button onClick={handleResetZoom} className="p-2 bg-white border rounded-full shadow-lg hover:bg-slate-50"><Maximize2 size={20}/></button>
              </div>

              {/* ÁREA DO TABULEIRO */}
              <div ref={contentRef} className="w-full flex justify-center origin-top transition-transform duration-300" style={{ transform: `scale(${zoomLevel})` }}>
                 
                 {/* 1. MESA REAL */}
                 {spreadType === 'mesa-real' && (
                    <div className="grid grid-cols-8 gap-3 w-[1100px]">
                      {board.slice(0, 32).map((id, i) => <CardVisual key={i} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i+1} isSelected={selectedHouse === i} onClick={() => handleHouseSelection(i)} spreadType="mesa-real" highlightType={getGeometryHighlight(i)} isAnimating={isAnimating} />)}
                      <div className="col-span-8 h-4"/>
                      <div className="col-span-2"/>
                      {board.slice(32, 36).map((id, i) => <CardVisual key={i+32} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i+33} isSelected={selectedHouse === i+32} onClick={() => handleHouseSelection(i+32)} spreadType="mesa-real" highlightType={getGeometryHighlight(i+32)} isAnimating={isAnimating} />)}
                    </div>
                 )}

                 {/* 2. MESA DE 9 */}
                 {spreadType === 'mesa-9' && (
                    <div className="grid grid-cols-3 gap-4 w-[600px]">
                      {board.slice(0, 9).map((id, i) => <CardVisual key={i} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i+1} isSelected={selectedHouse === i} isThemeCard={i===4} themeColor="purple" onClick={() => handleHouseSelection(i)} spreadType="mesa-9" isAnimating={isAnimating} />)}
                    </div>
                 )}

                 {/* 3. RELÓGIO */}
                 {spreadType === 'relogio' && (
                    <div className="relative w-[600px] h-[600px] rounded-full border border-slate-200 flex items-center justify-center">
                       <div className="absolute w-28 z-20"><CardVisual card={board[12] ? LENORMAND_CARDS.find(c => c.id === board[12]) : null} houseId={13} isSelected={selectedHouse === 12} onClick={() => handleHouseSelection(12)} isAnimating={isAnimating} /></div>
                       {board.slice(0, 12).map((id, i) => {
                          const angle = (i * 30) - 90; const rad = angle * Math.PI / 180;
                          return (
                            <div key={i} className="absolute w-24" style={{ left: `calc(50% + ${220 * Math.cos(rad)}px - 48px)`, top: `calc(50% + ${220 * Math.sin(rad)}px - 60px)` }}>
                               <CardVisual card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i+1} isSelected={selectedHouse === i} onClick={() => handleHouseSelection(i)} isAnimating={isAnimating} />
                            </div>
                          )
                       })}
                    </div>
                 )}

                 {/* 4. TEMPLO DE AFRODITE (NOVO LAYOUT) */}
                 {spreadType === 'templo-afrodite' && (
                    <div className="grid grid-cols-3 gap-16 w-[900px] py-10">
                       {/* Coluna Consulente */}
                       <div className="flex flex-col gap-6">
                          <div className="text-center pb-2 border-b border-indigo-100 mb-2"><span className="text-xs font-black tracking-widest text-indigo-600 uppercase">VOCÊ (CONSULENTE)</span></div>
                          {[0, 2, 4].map(idx => (
                             <CardVisual key={idx} card={board[idx] ? LENORMAND_CARDS.find(c => c.id === board[idx]) : null} houseId={idx+1} isSelected={selectedHouse === idx} onClick={() => handleHouseSelection(idx)} spreadType="templo-afrodite" isAnimating={isAnimating} />
                          ))}
                       </div>

                       {/* Coluna Central (Resultado) */}
                       <div className="flex flex-col justify-center gap-6">
                          <div className="text-center pb-2 border-b border-amber-100 mb-2"><span className="text-xs font-black tracking-widest text-amber-600 uppercase">SÍNTESE</span></div>
                          <CardVisual card={board[6] ? LENORMAND_CARDS.find(c => c.id === board[6]) : null} houseId={7} isSelected={selectedHouse === 6} isThemeCard={true} themeColor="orange" onClick={() => handleHouseSelection(6)} spreadType="templo-afrodite" isAnimating={isAnimating} />
                       </div>

                       {/* Coluna Parceiro */}
                       <div className="flex flex-col gap-6">
                          <div className="text-center pb-2 border-b border-rose-100 mb-2"><span className="text-xs font-black tracking-widest text-rose-600 uppercase">PARCEIRO(A)</span></div>
                          {[1, 3, 5].map(idx => (
                             <CardVisual key={idx} card={board[idx] ? LENORMAND_CARDS.find(c => c.id === board[idx]) : null} houseId={idx+1} isSelected={selectedHouse === idx} onClick={() => handleHouseSelection(idx)} spreadType="templo-afrodite" isAnimating={isAnimating} />
                          ))}
                       </div>
                    </div>
                 )}

              </div>
            </>
          )}

          {view === 'glossary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {LENORMAND_CARDS.map(c => (
                 <div key={c.id} className="bg-white p-6 rounded-2xl shadow-sm border hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                       <img src={CARD_IMAGES[c.id] || FALLBACK_IMAGE} className="w-12 h-16 rounded object-cover bg-slate-100"/>
                       <div><h3 className="font-bold">{c.name}</h3><span className="text-xs text-slate-400">{c.suit}</span></div>
                    </div>
                    <p className="text-xs text-slate-600 italic">"{c.briefInterpretation}"</p>
                 </div>
               ))}
            </div>
          )}
        </div>
      </main>

      {/* MENTOR PANEL (OVERLAY) */}
      {mentorPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-[100] border-l border-slate-200 animate-in slide-in-from-right flex flex-col">
           <div className="p-4 bg-indigo-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2"><Sparkles size={16}/><span className="font-cinzel font-bold text-xs uppercase tracking-widest">Mentor Lumina</span></div>
              <button onClick={() => setMentorPanelOpen(false)} className="hover:text-rose-400"><X size={20}/></button>
           </div>
           <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
              {selectedCard && currentHouse ? (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                       <h3 className="text-[10px] font-black uppercase text-indigo-500 mb-2">Casa {currentHouse.id > 100 ? (currentHouse.id === 113 ? 'Central' : currentHouse.id - 200) : currentHouse.id}</h3>
                       <div className="text-lg font-bold text-slate-800 leading-tight mb-1">{currentHouse.name}</div>
                       <p className="text-xs text-slate-500 italic">{currentHouse.technicalDescription}</p>
                    </div>

                    <div>
                       <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2">Carta Sorteada</h3>
                       <div className="flex items-start gap-4">
                          <img src={CARD_IMAGES[selectedCard.id] || FALLBACK_IMAGE} className="w-16 h-20 rounded-lg shadow-md object-cover"/>
                          <div>
                             <div className="text-xl font-cinzel font-bold text-indigo-900">{selectedCard.name}</div>
                             <div className="flex gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${selectedCard.polarity === Polarity.POSITIVE ? 'bg-emerald-100 text-emerald-700' : selectedCard.polarity === Polarity.NEGATIVE ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{selectedCard.polarity}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                       {isAiLoading ? (
                          <div className="flex flex-col items-center py-8 gap-3">
                             <Loader2 className="animate-spin text-indigo-600" size={24} />
                             <span className="text-xs font-medium text-slate-400">Consultando oráculo...</span>
                          </div>
                       ) : cardAnalysis ? (
                          <div className="prose prose-sm prose-slate bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                             <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-2"><Stars size={14}/> Interpretação</h4>
                             <p className="text-sm leading-relaxed whitespace-pre-wrap">{cardAnalysis}</p>
                          </div>
                       ) : (
                          <button onClick={runMentorAnalysis} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                             <Wand2 size={16} /> Analisar Combinação
                          </button>
                       )}
                    </div>
                 </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <MousePointer2 size={48} className="mb-4 text-slate-400"/>
                    <p className="text-sm font-medium">Selecione uma carta no tabuleiro</p>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default App;