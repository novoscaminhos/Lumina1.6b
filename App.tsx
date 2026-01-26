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
// Constantes do Modo Degustação
// ===============================
const TRIAL_DURATION_MS = 30 * 60 * 1000; // 30 minutos

type AccessType = 'full' | 'trial' | 'none';

// ===============================
// Componentes de Interface
// ===============================
const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void; disabled?: boolean }> = ({ icon, label, active, collapsed, onClick, disabled }) => (
  <button 
    onClick={disabled ? undefined : onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-900 hover:bg-slate-200 hover:text-indigo-950 font-bold'} ${collapsed ? 'justify-center px-0' : ''}`} 
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
  spreadType?: SpreadType;
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
      {/* Indicador de Seleção Visual (Dashed Border e Glow) - Agora mais visível */}
      {isSelected && (
        <div className="absolute -inset-4 border-[4px] border-dashed border-indigo-500/70 rounded-[1.4rem] animate-[spin_12s_linear_infinite] pointer-events-none" />
      )}

      <div className="card-visual-inner">
        {/* FACE FRONTAL */}
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
      <div 
        onClick={onToggle} 
        className={`p-6 cursor-pointer hover:bg-slate-800/10 flex flex-col`}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-xs font-bold uppercase tracking-widest text-indigo-800`}>{concept.title}</h4>
          <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} />
          </div>
        </div>
        <p className={`text-sm leading-relaxed mb-2 text-slate-700`}>{concept.text}</p>
        {concept.example && <p className="text-xs text-slate-500 italic">Ex: {concept.example}</p>}
      </div>
      
      {isOpen && (
        <div className={`px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 animate-in fade-in duration-300`}>
          <div className={`text-[13px] leading-relaxed whitespace-pre-wrap mb-6 text-slate-600`}>
            {concept.details}
          </div>
          {onPractice && concept.practiceTarget && (
            <button 
              onClick={(e) => { e.stopPropagation(); onPractice(); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
            >
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
  const [spreadType, setSpreadType] = useState<SpreadType>('mesa-real');
  const [isManualMode, setIsManualMode] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState<StudyLevel>('Iniciante');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('Geral');
  
  const [board, setBoard] = useState<(number | null)[]>([]);
  const [firstDrawBoard, setFirstDrawBoard] = useState<(number | null)[] | null>(null);
  const [secondDrawBoard, setSecondDrawBoard] = useState<(number | null)[] | null>(null);
  const [isViewingFirstDraw, setIsViewingFirstDraw] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
  // Inicia com 'todas' por padrão conforme solicitado
  const [geometryFilters, setGeometryFilters] = useState<Set<GeometryFilter>>(new Set(['todas']));
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [cardAnalysis, setCardAnalysis] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Zoom inicial padrão em 0.68 (68%) como valor médio inicial do Melhor Ajuste
  const [zoomLevel, setZoomLevel] = useState(0.68);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [unscaledHeight, setUnscaledHeight] = useState(800); 

  // --- ACCESS CONTROL & TRIAL MODE STATE ---
  const [accessType, setAccessType] = useState<AccessType>('none');
  const [trialExpired, setTrialExpired] = useState(false);
  // Inicialização Lazy do trialConsumed para garantir que leia do LocalStorage na montagem
  const [trialConsumed, setTrialConsumed] = useState(() => localStorage.getItem('lumina_trial_consumed') === 'true');
  const [trialTimeLeft, setTrialTimeLeft] = useState<string>("");

  // Derived state to replace previous boolean
  const isTrialMode = accessType === 'trial';

  // --- ACCESS CONTROL INITIALIZATION ---
  useEffect(() => {
  // 🔑 PRIORIDADE MÁXIMA: acesso vindo do portal/splash via URL
  const params = new URLSearchParams(window.location.search);
  const accessFromUrl = params.get('access') as AccessType | null;

  if (accessFromUrl === 'full') {
    localStorage.setItem('lumina_access_type', 'full');
    setAccessType('full');
    setTrialExpired(false);
    return;
  }

  if (accessFromUrl === 'trial') {
  const isConsumed = localStorage.getItem('lumina_trial_consumed') === 'true';

  if (isConsumed) {
    setAccessType('none');
    localStorage.removeItem('lumina_access_type');
    return;
  }

  const now = Date.now();
  localStorage.setItem('lumina_access_type', 'trial');
  localStorage.setItem('lumina_trial_token', now.toString());

  setAccessType('trial');
  setTrialExpired(false);
  return;
}

  // --- fluxo original continua ---
  const storedAccess = localStorage.getItem('lumina_access_type') as AccessType | null;
  const consumed = localStorage.getItem('lumina_trial_consumed') === 'true';
  const token = localStorage.getItem('lumina_trial_token');

    // 1. PRECEDÊNCIA: Full Access
    if (storedAccess === 'full') {
      setAccessType('full');
      setTrialExpired(false);
      return;
    }

    // 2. TRIAL MODE Check
    if (storedAccess === 'trial') {
      // Se já consumido, estado inválido (não deveria ser 'trial'). Força 'none' e garante flag.
      if (consumed) {
         setTrialConsumed(true);
         setAccessType('none'); 
         localStorage.removeItem('lumina_access_type'); // Limpa estado inconsistente
         return;
      }

      // Se tem token, verifica tempo
      if (token) {
        const startTime = parseInt(token, 10);
        const now = Date.now();
        const elapsed = now - startTime;

        if (elapsed >= TRIAL_DURATION_MS) {
          // Expirou
          setAccessType('trial'); // Define como trial para mostrar o overlay de expirado
          setTrialExpired(true);
          setTrialConsumed(true);
          localStorage.setItem('lumina_trial_consumed', 'true');
        } else {
          // Trial Válido
          setAccessType('trial');
          setTrialExpired(false);
        }
      } else {
        // Estado inconsistente (tem 'trial' no access type mas sem token). Reset para none.
        setAccessType('none');
        localStorage.removeItem('lumina_access_type');
      }
    } else {
      // Default: None
      setAccessType('none');
    }
  }, []);

  // --- TIMER LOGIC (Only runs if Trial Active & Not Expired) ---
  useEffect(() => {
    if (accessType !== 'trial' || trialExpired) return;

    const interval = setInterval(() => {
      const token = localStorage.getItem('lumina_trial_token');
      if (!token) return;

      const startTime = parseInt(token, 10);
      const now = Date.now();
      const remaining = TRIAL_DURATION_MS - (now - startTime);

      if (remaining <= 0) {
        // EXPIRED!
        setTrialExpired(true);
        setTrialConsumed(true);
        localStorage.setItem('lumina_trial_consumed', 'true');
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
    // Verifica se já consumiu
    const isConsumed = localStorage.getItem('lumina_trial_consumed') === 'true';
    if (isConsumed) {
      alert("O período de degustação já foi utilizado neste dispositivo.");
      setTrialConsumed(true);
      return;
    }

    const now = Date.now();
    // DEFINE CHAVES
    localStorage.setItem('lumina_access_type', 'trial');
    localStorage.setItem('lumina_trial_token', now.toString());
    
    // ATUALIZA ESTADO
    setAccessType('trial');
    setTrialExpired(false);
    // Permanece na home, mas desbloqueia a interface
  };

  const handleExitTrial = () => {
    // Remove apenas o estado de acesso ativo
    localStorage.removeItem('lumina_access_type');

    setAccessType('none');
    setTrialExpired(false);

    // 🔁 REDIRECIONAMENTO EXPLÍCITO AO PORTAL
    window.location.href = 'https://novoscaminhos.github.io/portal-lumina/index.html';
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.4));
  
  const handleResetZoom = useCallback(() => {
    if (boardRef.current && contentRef.current) {
      const container = boardRef.current;
      const content = contentRef.current;
      
      const originalTransform = content.style.transform;
      content.style.transform = 'none';
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;
      
      setUnscaledHeight(contentHeight);
      content.style.transform = originalTransform;

      // Cálculo de melhor ajuste visando a faixa de 65% a 75% em desktop
      const padding = spreadType === 'relogio' ? 40 : 100; 
      const scaleW = (containerWidth - padding) / contentWidth;
      const scaleH = (containerHeight - padding) / contentHeight;
      
      let fitScale = Math.min(scaleW, scaleH);
      
      // AJUSTE DINÂMICO PARA RELÓGIO
      if (spreadType === 'relogio') {
        // Permite zoom maior para o relógio, aproveitando melhor o espaço circular
        fitScale = Math.min(fitScale, 1.3); // Cap mais generoso
        fitScale = Math.max(0.6, fitScale); // Minimo legível
      } else {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop) {
          fitScale = Math.min(fitScale, 0.75);
        } else {
          fitScale = Math.min(fitScale, 1.0);
        }
      }
      
      fitScale = Math.max(0.25, fitScale);
      
      setZoomLevel(fitScale);
      setZoomMenuOpen(false);
    } else {
      setZoomLevel(0.68);
      setZoomMenuOpen(false);
    }
  }, [spreadType, view]);

  // Efeito para "Melhor Ajuste" sempre que o layout ou tabuleiro mudar
  useEffect(() => {
    if (view === 'board') {
      const timer = setTimeout(handleResetZoom, 500); 
      return () => clearTimeout(timer);
    }
  }, [view, spreadType, sidebarCollapsed, mentorPanelOpen, handleResetZoom]);

  // --- PROFILE STATE MANAGEMENT ---
  const [userName, setUserName] = useState(() => localStorage.getItem('lumina_user_name') || 'Estudante Lumina');
  const [userPhoto, setUserPhoto] = useState<string | null>(() => localStorage.getItem('lumina_user_photo') || null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState('');

  const [isExcludingReadings, setIsExcludingReadings] = useState(false);
  
  // MODIFIED: Load Saved Readings from LocalStorage
  const [savedReadings, setSavedReadings] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('lumina_saved_readings');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // --- PROFILE LOGIC ---
  const handleProfileNameSave = () => {
    if (tempName.trim()) {
      setUserName(tempName);
      localStorage.setItem('lumina_user_name', tempName);
    }
    setIsEditingProfile(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificação de tamanho: limite de 1MB para segurança do localStorage
    if (file.size > 1024 * 1024) {
      alert("A imagem selecionada é muito grande (Máx: 1MB). Por favor, escolha uma imagem menor para salvar no seu perfil.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      try {
        localStorage.setItem('lumina_user_photo', result);
        setUserPhoto(result);
      } catch (err) {
        alert("Erro ao salvar a foto: Espaço de armazenamento local excedido. Tente uma imagem menor.");
      }
    };
    reader.readAsDataURL(file);
  };

  // MODIFIED: Delete with persistence
  const handleDeleteReading = (id: number) => {
    const updated = savedReadings.filter(r => r.id !== id);
    setSavedReadings(updated);
    localStorage.setItem('lumina_saved_readings', JSON.stringify(updated));
  };

  // NEW: Save Reading
  const handleSaveReading = () => {
    // RESTRICTION: Only 'full' can save
    if (accessType !== 'full') {
      alert("Recurso indisponível no Modo Degustação.\n\nO salvamento de tiragens é exclusivo da versão completa.");
      return;
    }

    if (board.every(id => id === null)) {
      alert("O tabuleiro está vazio. Realize uma tiragem antes de salvar.");
      return;
    }

    const newReading = {
      id: Date.now(),
      title: `Leitura ${spreadType === 'mesa-real' ? 'Mesa Real' : spreadType === 'relogio' ? 'Relógio' : 'Mesa de 9'}`,
      date: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
      type: spreadType,
      board: board,
      firstDrawBoard: firstDrawBoard,
      secondDrawBoard: secondDrawBoard,
      cardAnalysis: cardAnalysis,
      selectedHouse: selectedHouse,
      geometryFilters: Array.from(geometryFilters), // Convert Set to Array
      isManualMode: isManualMode
    };

    const updated = [newReading, ...savedReadings];
    setSavedReadings(updated);
    localStorage.setItem('lumina_saved_readings', JSON.stringify(updated));
    alert("Leitura salva com sucesso!");
  };

  // NEW: Load Reading
  const handleLoadReading = (reading: any) => {
    // RESTRICTION: Only 'full' can load history
    if (accessType !== 'full') {
      alert("Recurso indisponível no Modo Degustação.\n\nO histórico de leituras é exclusivo da versão completa.");
      return;
    }
    
    setSpreadType(reading.type);
    setBoard(reading.board);
    setFirstDrawBoard(reading.firstDrawBoard || null);
    setSecondDrawBoard(reading.secondDrawBoard || null);
    setCardAnalysis(reading.cardAnalysis || null);
    setSelectedHouse(reading.selectedHouse);
    // Convert Array back to Set, handle legacy or empty
    setGeometryFilters(new Set(reading.geometryFilters || ['todas']));
    setIsManualMode(!!reading.isManualMode);
    
    setIsHistoryView(true);
    setView('board');
  };

  const [studyMode, setStudyMode] = useState<StudyModeState>({
    active: false,
    topicId: null,
    practiceTarget: null,
    splitView: false
  });
  const [activeBalloons, setActiveBalloons] = useState<StudyBalloon[]>([]);

  const [openConceptId, setOpenConceptId] = useState<string | null>(null);

  useEffect(() => {
    if (isManualMode && !isHistoryView) setBoard(new Array(36).fill(null));
    else if (!isHistoryView) handleShuffle();
    setSelectedHouse(null);
    setCardAnalysis(null);
  }, [spreadType, isManualMode]);

  const generateShuffledArray = (size: number, excludeIds: number[] = []) => {
    const ids = Array.from({length: 36}, (_, i) => i + 1).filter(id => !excludeIds.includes(id));
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, size);
  };

  const handleShuffle = () => {
    if (isHistoryView) return;
    setIsAnimating(true);
    const newBoard = generateShuffledArray(36);
    setBoard(newBoard);
    setFirstDrawBoard(null);
    setSecondDrawBoard(null);
    setIsViewingFirstDraw(false);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const handleSecondDraw = () => {
    if (spreadType !== 'relogio' || isHistoryView) return;
    setIsAnimating(true);
    const currentDraw = board.slice(0, 13);
    setFirstDrawBoard([...currentDraw]);
    
    const usedIds = currentDraw.filter(id => id !== null) as number[];
    const nextDraw = generateShuffledArray(13, usedIds);
    
    const updatedBoard = [...nextDraw, ...new Array(23).fill(null)];
    setBoard(updatedBoard);
    setSecondDrawBoard(updatedBoard);
    setIsViewingFirstDraw(false);
    setSelectedHouse(null);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  // MODIFIED: Clear Spread (Exit history)
  const handleClearSpread = () => {
    setBoard(new Array(36).fill(null));
    setFirstDrawBoard(null);
    setSecondDrawBoard(null);
    setIsViewingFirstDraw(false);
    setIsHistoryView(false); // Exit history mode
    setCardAnalysis(null);
  };

  const handleToggleDraws = () => {
    if (!firstDrawBoard || !secondDrawBoard || isHistoryView) return;
    setIsAnimating(true);
    if (isViewingFirstDraw) {
      setBoard([...secondDrawBoard]);
      setIsViewingFirstDraw(false);
    } else {
      const restored = [...firstDrawBoard, ...new Array(23).fill(null)];
      setBoard(restored);
      setIsViewingFirstDraw(true);
    }
    setSelectedHouse(null);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const selectedCard = useMemo(() => (selectedHouse !== null && board[selectedHouse]) ? LENORMAND_CARDS.find(c => c.id === board[selectedHouse]) : null, [selectedHouse, board]);
  
  const currentHouse = useMemo(() => {
    if (selectedHouse === null) return null;
    if (spreadType === 'relogio') {
      if (selectedHouse === 12) return { id: 113, name: "Tom da Leitura", theme: "Síntese Anual", technicalDescription: "A energia central que regula todo o ciclo anual de 12 meses." } as LenormandHouse;
      return LENORMAND_HOUSES.find(h => h.id === 101 + selectedHouse);
    }
    return LENORMAND_HOUSES[selectedHouse];
  }, [selectedHouse, spreadType]);

  const toggleFilter = (f: GeometryFilter) => {
    setGeometryFilters(prev => {
      const next = new Set(prev);
      if (f === 'nenhuma') { next.clear(); next.add('nenhuma'); }
      else if (f === 'todas') { next.clear(); next.add('todas'); }
      else { next.delete('nenhuma'); next.delete('todas'); if (next.has(f)) next.delete(f); else next.add(f); if (next.size === 0) next.add('nenhuma'); }
      return next;
    });
  };

  const handleHouseSelection = (index: number) => {
    setSelectedHouse(index);
    setMentorPanelOpen(true); 
    if (isManualMode && !isHistoryView) setShowCardPicker(true);
    else setCardAnalysis(null);
  };

  const handlePracticeMode = (topicId: string, target: SpreadType) => {
    setStudyMode({ active: true, topicId, practiceTarget: target, splitView: false });
    setSpreadType(target);
    setView('board');
    const isGlobal = topicId.includes('frame') || topicId.includes('moldura') || topicId.includes('veredict') || topicId.includes('veredito') || topicId.includes('clock') || topicId.includes('relogio');
    if (isGlobal) {
      setSelectedHouse(null);
    } else if (selectedHouse === null) {
      const occupiedIdx = board.findIndex(id => id !== null);
      if (occupiedIdx !== -1) setSelectedHouse(occupiedIdx);
    }
    
    const balloons = STUDY_BALLOONS[target];
    const matchingBalloon = balloons.find(b => topicId.includes(b.target));
    if (matchingBalloon) setActiveBalloons([matchingBalloon]);
  };

  const showDicas = () => {
    const balloons = STUDY_BALLOONS[spreadType];
    if (balloons && balloons.length > 0) {
      const randomBalloon = balloons[Math.floor(Math.random() * balloons.length)];
      setActiveBalloons([randomBalloon]);
    }
  };

  const exportToPDF = useCallback(async () => {
    if (!contentRef.current) return;
    try {
      // 1. Setup PDF (A4 Landscape Fixed)
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = 297;
      const pageHeight = 210;
      
      const headerSpace = 40; // Altura reservada para cabeçalho
      const safetyMargin = 15; // Margem de segurança lateral/inferior

      // 2. Draw Header (Vector Text via jsPDF)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 27, 75); // Indigo-950

      const titleMap: Record<string, string> = {
        'mesa-real': 'Mesa Real (36 Casas)',
        'mesa-9': 'Tiragem de 9 Cartas',
        'relogio': 'Tiragem do Relógio (12 Casas)'
      };
      const title = titleMap[spreadType] || 'Leitura Lumina';

      // Título Centralizado
      doc.text(title.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);

      const dateStr = new Date().toLocaleDateString('pt-BR');
      const timeStr = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
      
      // Subtítulo com dados da tiragem
      // WATERMARK logic: Only show watermark if TRIAL
      const trialWatermark = accessType === 'trial' ? " [MODO DEGUSTAÇÃO]" : "";
      doc.text(`Consulente: ${userName}${trialWatermark} | Data: ${dateStr} às ${timeStr}`, pageWidth / 2, 22, { align: 'center' });

      // Linha separadora
      doc.setDrawColor(200);
      doc.line(safetyMargin, 28, pageWidth - safetyMargin, 28);

      // Rodapé do cabeçalho / Info fixa
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Lumina 1.6 – sistema de estudo de baralho cigano", safetyMargin, 27);
      doc.text("Um produto de Lunara Terapias – Araraquara/SP", pageWidth - safetyMargin, 27, { align: 'right' });

      // 3. Capture Content (Cartas)
      const element = contentRef.current;
      
      // Salva o transform original para ignorar o zoom da tela
      const originalTransform = element.style.transform;
      // Reseta o transform para capturar na escala 1:1 "natural"
      element.style.transform = 'none';

      const canvas = await html2canvas(element, { 
        scale: 2, // Alta qualidade
        backgroundColor: '#ffffff', // Fundo branco forçado
        useCORS: true, 
        logging: false 
      });

      // Restaura o zoom da tela imediatamente
      element.style.transform = originalTransform;

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // 4. Calculate Fit (Ajuste Matemático com Fator de Segurança)
      // Área disponível para a imagem (reduzida para garantir que não haja cortes)
      const availableWidth = pageWidth - (safetyMargin * 2);
      const availableHeight = pageHeight - headerSpace - safetyMargin;

      // Cálculo da proporção para caber sem cortar (contain)
      const ratioW = availableWidth / imgWidth;
      const ratioH = availableHeight / imgHeight;
      
      // Fator de segurança (0.95) para evitar sangria visual e garantir centralização perfeita
      const safetyFactor = 0.95;
      const scale = Math.min(ratioW, ratioH) * safetyFactor;

      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;

      // 5. Center (Centralização Robusta)
      const x = (pageWidth - finalWidth) / 2;
      const y = headerSpace + ((availableHeight - finalHeight) / 2);

      doc.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      doc.save(`Lumina-Leitura-${spreadType}-${Date.now()}.pdf`);

    } catch (err) { 
      console.error("Erro ao exportar PDF:", err); 
    }
  }, [spreadType, userName, accessType]);

  const getGeometryHighlight = (idx: number) => {
    if (!geometryFilters.has('nenhuma')) {
      const showAll = geometryFilters.has('todas');
      
      // Mesa de 9 Cartas
      if (spreadType === 'mesa-9') {
        if ((showAll || geometryFilters.has('centro')) && Geometry.isCenter9Cards(idx)) return 'center';
        if ((showAll || geometryFilters.has('cruz')) && Geometry.getFixedCross9().includes(idx)) return 'cruz';
        if ((showAll || geometryFilters.has('diagonais')) && Geometry.getFixedDiagonals9().includes(idx)) return 'diag-up';
        return null;
      }

      // Mesa Real
      if (spreadType === 'mesa-real') {
        if ((showAll || geometryFilters.has('moldura')) && Geometry.getMoldura().includes(idx)) return 'frame';
        if ((showAll || geometryFilters.has('veredito')) && idx >= 32) return 'veredito';
        if (selectedHouse !== null) {
          if (showAll || geometryFilters.has('ponte')) {
            const targetId = selectedHouse + 1;
            const targetIdx = board.findIndex(id => id === (targetId));
            if (idx === targetIdx) return 'bridge';
          }
          if (showAll || geometryFilters.has('cavalo')) if (Geometry.getCavalo(selectedHouse).includes(idx)) return 'knight';
          if (showAll || geometryFilters.has('diagonais')) {
            if (Geometry.getDiagonaisSuperiores(selectedHouse).includes(idx)) return 'diag-up';
            if (Geometry.getDiagonaisInferiores(selectedHouse).includes(idx)) return 'diag-down';
          }
        }
      }
    }

    if (studyMode.active && studyMode.topicId) {
      const topicId = studyMode.topicId;
      if ((topicId.includes('frame') || topicId.includes('moldura')) && Geometry.getMoldura().includes(idx)) return 'frame';
      if ((topicId.includes('veredict') || topicId.includes('veredito')) && idx >= 32) return 'veredito';
      if (selectedHouse !== null) {
        if (topicId.includes('ponte')) {
          const targetId = selectedHouse + 1;
          const targetIdx = board.findIndex(id => id === (targetId));
          if (idx === targetIdx) return 'bridge';
        }
        if (topicId.includes('knight') || topicId.includes('cavalo')) if (Geometry.getCavalo(selectedHouse).includes(idx)) return 'knight';
        if (topicId.includes('mirror') || topicId.includes('espelho')) if (Geometry.getEspelhamentos(selectedHouse).includes(idx)) return 'mirror';
        if (topicId.includes('diagonal-superior')) if (Geometry.getDiagonaisSuperiores(selectedHouse).includes(idx)) return 'diag-up';
        if (topicId.includes('diagonal-inferior')) if (Geometry.getDiagonaisInferiores(selectedHouse).includes(idx)) return 'diag-down';
        if (topicId.includes('diagonal') && !topicId.includes('-')) {
             if (Geometry.getDiagonaisSuperiores(selectedHouse).includes(idx)) return 'diag-up';
             if (Geometry.getDiagonaisInferiores(selectedHouse).includes(idx)) return 'diag-down';
        }
      }
      if (spreadType === 'relogio') {
        if (topicId.includes('center') || topicId.includes('centro')) if (idx === 12) return 'center';
        if (topicId.includes('house') || topicId.includes('casa')) return 'axis';
        if (topicId.includes('oposicao') || topicId.includes('opposition')) if (selectedHouse !== null && idx === Geometry.getOposicaoRelogio(selectedHouse)) return 'axis';
      }
      // Study mode Mesa 9
      if (spreadType === 'mesa-9') {
        if (topicId.includes('center') && Geometry.isCenter9Cards(idx)) return 'center';
        if (topicId.includes('diagonals') && Geometry.getFixedDiagonals9().includes(idx)) return 'diag-up';
        if (topicId.includes('cross') && Geometry.getFixedCross9().includes(idx)) return 'cruz';
        if (topicId.includes('column') && Geometry.getFixedColumns9().includes(idx)) return 'axis';
      }
    }

    if (spreadType === 'relogio' && !studyMode.active) {
      if (idx === 12) return 'center';
      if (selectedHouse !== null && idx === Geometry.getOposicaoRelogio(selectedHouse)) return 'axis';
    }
    return null;
  };

  const bridgeData = useMemo(() => {
    if (selectedHouse === null || spreadType !== 'mesa-real') return null;
    const targetIdx = board.findIndex(id => id === (selectedHouse + 1));
    return targetIdx !== -1 ? { card: LENORMAND_CARDS.find(c => c.id === board[targetIdx]), house: LENORMAND_HOUSES[targetIdx], houseId: targetIdx + 1 } : null;
  }, [selectedHouse, board, spreadType]);

  const knightData = useMemo(() => {
    if (selectedHouse === null || spreadType !== 'mesa-real') return [];
    return Geometry.getCavalo(selectedHouse).map(idx => ({ card: board[idx] ? LENORMAND_CARDS.find(c => c.id === board[idx]) : null, house: LENORMAND_HOUSES[idx], houseId: idx + 1 })).filter(i => i.card);
  }, [selectedHouse, board, spreadType]);

  const diagonalData = useMemo(() => {
    if (selectedHouse === null || spreadType !== 'mesa-real') return { up: [], down: [] };
    const mapper = (idx: number) => ({ card: board[idx] ? LENORMAND_CARDS.find(c => c.id === board[idx]) : null, houseId: idx + 1 });
    return { up: Geometry.getDiagonaisSuperiores(selectedHouse).map(mapper).filter(i => i.card), down: Geometry.getDiagonaisInferiores(selectedHouse).map(mapper).filter(i => i.card) };
  }, [selectedHouse, board, spreadType]);

  const axisDataRelogio = useMemo(() => {
    if (selectedHouse === null || spreadType !== 'relogio' || selectedHouse === 12) return null;
    const oppositeIdx = Geometry.getOposicaoRelogio(selectedHouse);
    return { axis: Geometry.getAxisDataRelogio(selectedHouse), oppositeCard: board[oppositeIdx] ? LENORMAND_CARDS.find(c => c.id === board[oppositeIdx]) : null, oppositeHouseId: oppositeIdx + 1 };
  }, [selectedHouse, board, spreadType]);

  const firstDrawHistoryData = useMemo(() => {
    if (!firstDrawBoard || spreadType !== 'relogio') return null;
    return firstDrawBoard.slice(0, 13).map((id, idx) => {
      const card = id ? LENORMAND_CARDS.find(c => c.id === id) : null;
      const house = idx === 12 ? { id: 113, name: "Tom da Leitura" } : LENORMAND_HOUSES.find(h => h.id === 101 + idx);
      return { card, house, houseId: idx + 1 };
    }).filter(item => item.card);
  }, [firstDrawBoard, spreadType]);

  const secondDrawHistoryData = useMemo(() => {
    if (!secondDrawBoard || spreadType !== 'relogio') return null;
    return secondDrawBoard.slice(0, 13).map((id, idx) => {
      const card = id ? LENORMAND_CARDS.find(c => c.id === id) : null;
      const house = idx === 12 ? { id: 113, name: "Tom da Leitura" } : LENORMAND_HOUSES.find(h => h.id === 101 + idx);
      return { card, house, houseId: idx + 1 };
    }).filter(item => item.card);
  }, [secondDrawBoard, spreadType]);

  const runMentorAnalysis = useCallback(async () => {
    if (selectedHouse === null || board[selectedHouse] === null) return;
    setIsAiLoading(true); setCardAnalysis(null);
    try {
      const result = await getDetailedCardAnalysis(board, selectedHouse, readingTheme, spreadType, difficultyLevel);
      setCardAnalysis(result);
    } catch (error) { setCardAnalysis("Erro de conexão com o Mentor."); }
    finally { setIsAiLoading(false); }
  }, [board, selectedHouse, readingTheme, spreadType, difficultyLevel]);

  // MODIFIED: footerActions linked to handleSaveReading
  const footerActions = [
    { label: 'Salvar', icon: <Save size={18} strokeWidth={2.5} className="w-full h-full"/>, onClick: handleSaveReading },
    { label: 'Exportar', icon: <Download size={18} strokeWidth={2.5} className="w-full h-full"/>, onClick: exportToPDF },
    { label: 'Perfil', icon: <User size={18} strokeWidth={2.5} className="w-full h-full"/>, onClick: () => setView('profile') }
  ];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 transition-colors overflow-hidden font-inter`}>
      
      {trialExpired && accessType !== 'full' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 max-w-2xl w-full text-center shadow-2xl border border-slate-200 relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-sm border border-rose-100">
              <Lock size={40} />
            </div>

            <h2 className="text-3xl md:text-4xl font-cinzel font-black text-slate-900 mb-6 uppercase tracking-wide">
              Período de teste encerrado
            </h2>

            <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed mb-10 font-medium">
              <p>
                O Lumina é uma ferramenta completa de leitura simbólica e estudo de tiragens, desenvolvida para uso contínuo e pessoal.
              </p>
              <p>
                Para acessar todas as modalidades de tiragem, utilizar o sistema sem limitações e retornar sempre que desejar, é necessário possuir uma <span className="font-bold text-indigo-700">chave de acesso individual</span>.
              </p>
              <p className="text-xs md:text-sm text-slate-500 pt-2 border-t border-slate-100 mt-4">
                Caso deseje adquirir uma chave, tirar dúvidas ou sugerir novas funções e tiragens, entre em contato com o Adm. do sistema (Celso Luiz - Lunara Terapias).
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <a 
                href="./index.html" 
                className="w-full md:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Acessar o Portal Lumina
              </a>
              
              <a 
                href="https://wa.me/5516997934558" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full md:w-auto px-8 py-4 bg-emerald-500 hover:bg-white hover:text-emerald-600 border-2 border-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 flex items-center justify-center gap-2 group"
              >
                <MessageSquare size={16} className="group-hover:scale-110 transition-transform" />
                Contatar Administração (WhatsApp)
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar (mantida) */}
      <aside className={`fixed md:sticky top-0 inset-y-0 left-0 flex flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 z-[60] h-screen ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Reconstructed Sidebar Content */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
           {!sidebarCollapsed && <span className="font-cinzel font-bold text-lg text-indigo-900">Lumina</span>}
           <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
             {sidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
           </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <NavItem icon={<Home size={20} />} label="Início" active={view === 'home'} collapsed={sidebarCollapsed} onClick={() => setView('home')} />
          <NavItem icon={<LayoutGrid size={20} />} label="Mesa" active={view === 'board'} collapsed={sidebarCollapsed} onClick={() => setView('board')} />
          <NavItem icon={<BookOpen size={20} />} label="Fundamentos" active={view === 'fundamentals'} collapsed={sidebarCollapsed} onClick={() => setView('fundamentals')} />
          <NavItem icon={<ListFilter size={20} />} label="Glossário" active={view === 'glossary'} collapsed={sidebarCollapsed} onClick={() => setView('glossary')} />
          <NavItem icon={<GraduationCap size={20} />} label="Estudo" active={view === 'study'} collapsed={sidebarCollapsed} onClick={() => setView('study')} />
        </nav>

        <div className="p-2 border-t border-slate-100">
          <NavItem icon={<User size={20} />} label="Perfil" active={view === 'profile'} collapsed={sidebarCollapsed} onClick={() => setView('profile')} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-40">
            <div className="flex items-center gap-4">
               <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="md:hidden p-2 -ml-2 text-slate-500">
                 <Menu size={24} />
               </button>
               <h1 className="text-lg font-bold text-slate-800 capitalize">
                 {view === 'board' ? (spreadType === 'mesa-real' ? 'Mesa Real' : spreadType === 'relogio' ? 'Relógio' : 'Mesa de 9') : 
                  view === 'fundamentals' ? 'Fundamentos' : 
                  view === 'glossary' ? 'Glossário' : 
                  view === 'study' ? 'Modo Estudo' : 
                  view === 'profile' ? 'Meu Perfil' : 'Início'}
               </h1>
            </div>
            
            <div className="flex items-center gap-3">
               {isTrialMode && (
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
                   <Clock size={14} />
                   <span>{trialTimeLeft}</span>
                 </div>
               )}
            </div>
         </header>

         <div className="flex-1 overflow-y-auto relative p-4 md:p-8" ref={contentRef}>
            <div ref={boardRef} className="min-h-full">
               
               {view === 'home' && (
                 <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-500">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                      <Stars size={48} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-cinzel font-black text-slate-900 mb-2">Lumina</h2>
                      <p className="text-slate-600 text-lg">Sistema de Estudo de Baralho Cigano</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
                       <button onClick={() => setView('board')} className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all group">
                          <LayoutGrid className="text-indigo-500 group-hover:scale-110 transition-transform" />
                          <span className="font-bold text-slate-700">Ir para Mesa</span>
                       </button>
                       <button onClick={() => setView('fundamentals')} className="flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all group">
                          <BookOpen className="text-indigo-500 group-hover:scale-110 transition-transform" />
                          <span className="font-bold text-slate-700">Estudar Fundamentos</span>
                       </button>
                    </div>

                    {accessType === 'none' && (
                      <button onClick={handleStartTrial} className="mt-8 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold tracking-wider uppercase shadow-xl hover:bg-indigo-700 transition-all hover:scale-105">
                         Iniciar Degustação Gratuita
                      </button>
                    )}
                 </div>
               )}

               {view === 'board' && (
                 <div className="flex flex-col items-center gap-8 pb-20">
                    {/* Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 sticky top-0 z-30">
                       <div className="flex items-center bg-slate-100 rounded-xl p-1">
                          <button onClick={() => setSpreadType('mesa-real')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${spreadType === 'mesa-real' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Mesa Real</button>
                          <button onClick={() => setSpreadType('mesa-9')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${spreadType === 'mesa-9' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Mesa de 9</button>
                          <button onClick={() => setSpreadType('relogio')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${spreadType === 'relogio' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Relógio</button>
                       </div>
                       
                       <div className="w-px h-6 bg-slate-200 mx-2" />
                       
                       <button onClick={handleShuffle} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors">
                          <RefreshCw size={14} /> Embaralhar
                       </button>

                       {/* Footer Actions moved here for better UX in reconstruction */}
                       {footerActions.map((action, idx) => (
                          <button key={idx} onClick={action.onClick} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors" title={action.label}>
                             <div className="w-4 h-4">{action.icon}</div>
                             <span className="hidden sm:inline">{action.label}</span>
                          </button>
                       ))}
                    </div>

                    {/* The Board Grid */}
                    <div 
                      className={`
                        grid gap-2 md:gap-4 transition-all duration-500 ease-in-out origin-top
                        ${spreadType === 'mesa-real' ? 'grid-cols-8 md:grid-cols-9 w-full max-w-7xl' : ''}
                        ${spreadType === 'mesa-9' ? 'grid-cols-3 w-full max-w-md' : ''}
                        ${spreadType === 'relogio' ? 'grid-cols-4 w-full max-w-3xl' : ''} 
                      `}
                      style={{ transform: `scale(${zoomLevel})` }}
                    >
                      {spreadType === 'mesa-real' && Array.from({length: 36}).map((_, i) => (
                         <div key={i} className={`relative ${i >= 32 ? 'col-start-3 md:col-start-auto' : ''}`}>
                            <CardVisual 
                              card={board[i] ? LENORMAND_CARDS.find(c => c.id === board[i]) : null}
                              houseId={i+1}
                              onClick={() => handleHouseSelection(i)}
                              isSelected={selectedHouse === i}
                              isThemeCard={false}
                              isManualMode={isManualMode}
                              spreadType={spreadType}
                              studyModeActive={studyMode.active}
                              highlightType={getGeometryHighlight(i)}
                              isAnimating={isAnimating}
                            />
                         </div>
                      ))}
                      
                      {spreadType === 'mesa-9' && Array.from({length: 9}).map((_, i) => (
                         <div key={i} className="relative">
                            <CardVisual 
                              card={board[i] ? LENORMAND_CARDS.find(c => c.id === board[i]) : null}
                              houseId={i+1}
                              onClick={() => handleHouseSelection(i)}
                              isSelected={selectedHouse === i}
                              isThemeCard={false}
                              isManualMode={isManualMode}
                              spreadType={spreadType}
                              studyModeActive={studyMode.active}
                              highlightType={getGeometryHighlight(i)}
                              isAnimating={isAnimating}
                            />
                         </div>
                      ))}
                      
                      {spreadType === 'relogio' && (
                        <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-10">
                           <p>Modo Relógio (Layout Circular) requer implementação CSS complexa.</p>
                           <p className="text-xs mt-2">Visualização simplificada em grid para manutenção.</p>
                           <div className="grid grid-cols-4 gap-2 mt-4">
                             {Array.from({length: 13}).map((_, i) => (
                               <div key={i} className="w-20">
                                  <CardVisual 
                                    card={board[i] ? LENORMAND_CARDS.find(c => c.id === board[i]) : null}
                                    houseId={i+1}
                                    onClick={() => handleHouseSelection(i)}
                                    isSelected={selectedHouse === i}
                                    isThemeCard={i===12}
                                    isManualMode={isManualMode}
                                    spreadType={spreadType}
                                    studyModeActive={studyMode.active}
                                    highlightType={getGeometryHighlight(i)}
                                    isAnimating={isAnimating}
                                  />
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                 </div>
               )}

               {view === 'fundamentals' && (
                 <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                          <BookOpen size={24} />
                       </div>
                       <div>
                          <h2 className="text-2xl font-bold text-slate-900">Fundamentos</h2>
                          <p className="text-slate-500">Base teórica do sistema Lumina</p>
                       </div>
                    </div>
                    
                    {FUNDAMENTALS_DATA.map(module => (
                      <div key={module.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                         <h3 className="text-lg font-bold text-indigo-800 mb-2">{module.title}</h3>
                         <p className="text-slate-600 text-sm mb-6 leading-relaxed">{module.description}</p>
                         <div className="space-y-3">
                            {module.concepts.map(concept => (
                              <ConceptAccordion 
                                key={concept.id}
                                concept={concept}
                                isOpen={openConceptId === concept.id}
                                onToggle={() => setOpenConceptId(openConceptId === concept.id ? null : concept.id!)}
                                onPractice={() => concept.practiceTarget && handlePracticeMode(concept.id || '', concept.practiceTarget)}
                              />
                            ))}
                         </div>
                      </div>
                    ))}
                 </div>
               )}

               {view === 'profile' && (
                 <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <div className="w-32 h-32 bg-slate-100 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg relative group">
                       {userPhoto ? (
                         <img src={userPhoto} className="w-full h-full object-cover" alt="Perfil" />
                       ) : (
                         <User size={48} className="text-slate-300" />
                       )}
                       <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold uppercase tracking-widest">
                          Alterar
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                       </label>
                    </div>
                    
                    {isEditingProfile ? (
                      <div className="flex items-center gap-2 justify-center mb-6">
                         <input 
                           type="text" 
                           value={tempName} 
                           onChange={e => setTempName(e.target.value)}
                           className="border border-slate-300 rounded-lg px-4 py-2 text-center"
                           placeholder="Seu nome"
                         />
                         <button onClick={handleProfileNameSave} className="p-2 bg-emerald-500 text-white rounded-lg"><CheckCircle2 size={20} /></button>
                      </div>
                    ) : (
                      <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-2">
                        {userName}
                        <button onClick={() => { setTempName(userName); setIsEditingProfile(true); }} className="text-slate-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                      </h2>
                    )}
                    
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100">
                       <Award size={16} />
                       <span>Nível: {difficultyLevel}</span>
                    </div>

                    <div className="mt-12 pt-8 border-t border-slate-100">
                       <button onClick={handleExitTrial} className="text-rose-500 text-sm font-bold hover:underline">Sair do Sistema</button>
                    </div>
                 </div>
               )}
            </div>
         </div>

         {/* Balloons Overlay */}
         {activeBalloons.map((balloon, idx) => (
            <Balloon key={idx} balloon={balloon} onDismiss={() => setActiveBalloons(prev => prev.filter((_, i) => i !== idx))} />
         ))}

      </main>

      {/* Mentor Panel */}
      {mentorPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-[80] border-l border-slate-200 animate-in slide-in-from-right duration-300 flex flex-col">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <Sparkles size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900">Mentor IA</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Análise Simbólica</p>
                 </div>
              </div>
              <button onClick={() => setMentorPanelOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-900">
                 <X size={20} />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6">
              {cardAnalysis ? (
                 <div className="prose prose-indigo prose-sm">
                    <div dangerouslySetInnerHTML={{ __html: cardAnalysis.replace(/\n/g, '<br/>') }} />
                 </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                    {isAiLoading ? (
                       <>
                         <Loader2 className="animate-spin text-indigo-600" size={40} />
                         <p className="font-medium text-indigo-900">Consultando o oráculo...</p>
                       </>
                    ) : (
                       <>
                         <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                           <Brain size={32} className="text-slate-400" />
                         </div>
                         <p className="max-w-[200px]">Clique no botão abaixo para gerar uma interpretação detalhada desta casa.</p>
                         <button onClick={runMentorAnalysis} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all">
                            Gerar Análise
                         </button>
                       </>
                    )}
                 </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
};

export default App;