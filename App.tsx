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
      
      {/* ... (TRIAL EXPIRED OVERLAY e Sidebar mantidos) ... */}
      
      {/* Sidebar (mantida) */}
      <aside className={`fixed md:sticky top-0 inset-y-0 left-0 flex flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 z-[60] h-screen ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <img 
               src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" 
               alt="L" 
               className={`object-contain transition-all ${sidebarCollapsed ? 'w-8 h-8 mx-auto' : 'w-5 h-5'} landscape:w-5 landscape:h-5`} 
             />
             {!sidebarCollapsed && (
               <h1 className={`text-xs font-bold font-cinzel text-indigo-950 landscape:text-[10px]`}>LUMINA</h1>
             )}
           </div>
           <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`p-2 rounded-lg text-slate-500 hover:text-slate-900`}>{sidebarCollapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button>
        </div>
        
        <nav className="px-2 space-y-2 overflow-y-auto custom-scrollbar shrink-0">
          <NavItem icon={<Home size={18}/>} label="Início" active={view === 'home'} collapsed={sidebarCollapsed} onClick={() => {setView('home'); setStudyMode(prev => ({ ...prev, active: false }));}} />
          <NavItem icon={<LayoutGrid size={18}/>} label="Mesa Real" active={view === 'board' && spreadType === 'mesa-real' && !studyMode.active} collapsed={sidebarCollapsed} onClick={() => {setView('board'); setSpreadType('mesa-real'); setIsManualMode(false); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<Grid3x3 size={18}/>} label="Mesa de 9" active={view === 'board' && spreadType === 'mesa-9' && !studyMode.active} collapsed={sidebarCollapsed} onClick={() => {setView('board'); setSpreadType('mesa-9'); setIsManualMode(false); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<Clock size={18}/>} label="Relógio" active={view === 'board' && spreadType === 'relogio' && !studyMode.active} collapsed={sidebarCollapsed} onClick={() => {setView('board'); setSpreadType('relogio'); setIsManualMode(false); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<Book size={18}/>} label="Glossário" active={view === 'glossary'} collapsed={sidebarCollapsed} onClick={() => {setView('glossary'); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<BookOpen size={18}/>} label="Fundamentos" active={view === 'fundamentals'} collapsed={sidebarCollapsed} onClick={() => {setView('fundamentals'); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<Edit3 size={18}/>} label="Personalizada" active={view === 'board' && isManualMode} collapsed={sidebarCollapsed} onClick={() => {setView('board'); setIsManualMode(true); setStudyMode(prev => ({ ...prev, active: false }));}} disabled={accessType === 'none'} />
          <NavItem icon={<GraduationCap size={18}/>} label="📘 Modo Estudo" active={view === 'study' || (view === 'board' && studyMode.active)} collapsed={sidebarCollapsed} onClick={() => {setView('study'); setStudyMode(prev => ({ ...prev, active: true }));}} disabled={accessType === 'none'} />
        </nav>
        
        {!sidebarCollapsed && (
          <div className="flex-grow flex flex-col items-center justify-center p-6 select-none pointer-events-none opacity-40 landscape:hidden">
             <img 
               src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" 
               alt="LUMINA" 
               className="w-32 h-32 object-contain"
             />
             <div className={`mt-4 text-[10px] font-cinzel font-black tracking-[0.4em] text-indigo-900`}>LUMINA</div>
          </div>
        )}

        <div className={`p-4 border-t border-slate-200 space-y-2 shrink-0`}>
          {footerActions.map((action, idx) => (
            <div key={idx} className="relative w-full">
              <button onClick={action.onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all text-indigo-950 bg-indigo-100 border border-indigo-300 hover:bg-indigo-600 hover:text-white ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
                <div className={`flex items-center justify-center shrink-0 w-5 h-5`}>
                   {action.icon}
                </div>
                {!sidebarCollapsed && <span className="text-[10px] uppercase tracking-widest">{action.label}</span>}
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content (Mantido, apenas referenciado) */}
      <main className="flex-grow flex flex-col h-screen overflow-y-auto custom-scrollbar relative">
        {/* Header e Body do Main (Mantidos) */}
        <header className={`h-16 flex items-center justify-between px-10 border-b sticky top-0 z-20 backdrop-blur-md transition-colors bg-white/95 border-slate-200 shadow-sm`}>
          <h2 className={`font-cinzel text-sm font-black tracking-widest uppercase text-slate-900`}>
            {view === 'home' ? 'Bem-vindo ao Lumina' : view === 'board' ? (studyMode.active ? 'Estudo Prático' : isHistoryView ? 'Visualizando Histórico' : isManualMode ? 'Mesa Personalizada' : spreadType === 'mesa-real' ? 'Mesa Real' : spreadType === 'mesa-9' ? 'Quadrado de 9' : 'Relógio') : view === 'glossary' ? 'Glossário' : view === 'fundamentals' ? 'Fundamentos' : view === 'profile' ? 'Perfil do Usuário' : view === 'study' ? 'Modo Estudo' : 'Estudo'}
          </h2>
          {/* Trial Timer */}
          {accessType === 'trial' && !trialExpired && (
             <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-full animate-pulse ml-4">
                <Timer size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest font-mono">{trialTimeLeft}</span>
             </div>
          )}

          {view === 'board' && (
            <div className="flex items-center gap-2 ml-auto">
               {studyMode.active && (
                 <div className={`mr-4 px-4 py-1.5 rounded-full border flex items-center gap-3 bg-indigo-50 border-indigo-200 text-indigo-700`}>
                   <Brain size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Destaque: {studyMode.topicId?.split('-').join(' ')}</span>
                   <button onClick={() => setStudyMode(prev => ({ ...prev, active: false, topicId: null }))} className="hover:text-rose-500 transition-colors"><X size={14} /></button>
                 </div>
               )}
               {isHistoryView && (
                 <div className={`mr-4 px-4 py-1.5 rounded-full border flex items-center gap-3 bg-amber-50 border-amber-200 text-amber-700`}>
                   <History size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">MODO HISTÓRICO (LEITURA)</span>
                 </div>
               )}
               <button onClick={showDicas} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-600 hover:text-white animate-pulse`}><Lightbulb size={14} /> DICAS</button>
               {!studyMode.active && (
                 <div className={`flex p-1 rounded-xl border bg-white border-slate-200 shadow-sm border shadow-sm`}>
                   {(['nenhuma', 'ponte', 'cavalo', 'moldura', 'veredito', 'diagonais', 'centro', 'cruz', 'todas'] as any[]).map(f => {
                     if (spreadType === 'mesa-9' && !['nenhuma', 'todas', 'centro', 'cruz', 'diagonais'].includes(f)) return null;
                     if (spreadType === 'mesa-real' && ['centro', 'cruz'].includes(f)) return null;
                     if (spreadType === 'relogio' && !['nenhuma', 'todas'].includes(f)) return null;

                     const isActive = geometryFilters.has(f as GeometryFilter);
                     const showAll = geometryFilters.has('todas');
                     
                     const activeStyle = isActive || (showAll && f !== 'nenhuma' && f !== 'todas') ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100';

                     return (
                       <button 
                         key={f} 
                         onClick={() => toggleFilter(f as GeometryFilter)} 
                         className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all border border-transparent ${activeStyle}`}
                       >
                         {f}
                       </button>
                     );
                   })}
                 </div>
               )}
               
               <div className="flex items-center gap-2 ml-4">
                 <button onClick={handleClearSpread} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all bg-slate-200 hover:bg-slate-300 text-slate-700`} title={isHistoryView ? "Sair do Histórico" : "Limpar todo o tabuleiro"}>
                   {isHistoryView ? <LogOut size={14} /> : <Trash2 size={14} />} 
                   {isHistoryView ? 'SAIR DO HISTÓRICO' : 'LIMPAR'}
                 </button>
                 
                 {!isHistoryView && spreadType === 'relogio' && firstDrawBoard && secondDrawBoard && (
                   <button onClick={handleToggleDraws} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl">
                     {isViewingFirstDraw ? <Stars size={14} /> : <RotateCcw size={14} />} 
                     {isViewingFirstDraw ? 'VOLTAR PARA 2ª TIRAGEM' : 'REVER 1ª TIRAGEM'}
                   </button>
                 )}
                 
                 {!isHistoryView && spreadType === 'relogio' && !firstDrawBoard && board.some(id => id !== null) && (
                    <button onClick={handleSecondDraw} className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl"><Stars size={14} /> SEGUNDA TIRAGEM</button>
                 )}

                 {!isHistoryView && (
                   <button onClick={handleShuffle} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl"><RotateCcw size={14} /> {spreadType === 'relogio' ? 'NOVA TIRAGEM' : 'EMBARALHAR'}</button>
                 )}
               </div>
            </div>
          )}
        </header>

        <div className="p-4 md:p-10 flex-grow flex flex-col min-h-0 relative">
          {activeBalloons.map((b, i) => <Balloon key={i} balloon={b} onDismiss={() => setActiveBalloons(prev => prev.filter(x => x !== b))} />)}
          
          {view === 'home' && (
            <div className="max-w-6xl mx-auto w-full flex flex-col items-center justify-center py-10 animate-in fade-in duration-700">
               {/* Home Content (Mantido) */}
               <div className="text-center mb-16 space-y-4">
                 <img src="https://kehebufapvrmuzaovnzh.supabase.co/storage/v1/object/public/lenormand-cards/LOGO.png" alt="LUMINA" className="w-32 h-32 mx-auto mb-6 object-contain" />
                 <h1 className="text-4xl md:text-5xl font-cinzel font-black text-slate-900">LUMINA</h1>
                 <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">Selecione uma modalidade de tiragem abaixo para iniciar sua jornada de autoconhecimento através das cartas.</p>
                 {accessType === 'none' && !trialConsumed && (
                    <button onClick={handleStartTrial} className="mt-6 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-cinzel font-bold tracking-widest uppercase shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all flex items-center gap-2 mx-auto animate-bounce">
                       <Zap size={20} /> Iniciar Degustação (30 min)
                    </button>
                 )}
                 {trialConsumed && accessType !== 'full' && (
                   <div className="mt-4 px-6 py-3 bg-slate-100 rounded-full border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Lock size={14} /> Período de teste encerrado</div>
                 )}
               </div>
               {/* Cards Home (Mantidos) */}
               <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl transition-all duration-500 ${accessType === 'none' ? 'opacity-50 grayscale pointer-events-none filter blur-sm' : ''}`}>
                  <div onClick={() => { setView('board'); setSpreadType('mesa-real'); setIsManualMode(false); }} className="group relative bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-indigo-500 transition-all cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col h-full"><div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform"><LayoutGrid size={28} /></div><h3 className="text-xl font-cinzel font-bold text-slate-900 mb-2">Mesa Real</h3><p className="text-xs text-slate-500 leading-relaxed mb-6">A leitura completa de 36 casas. Ideal para panoramas gerais e previsões detalhadas.</p><div className="mt-auto flex items-center text-indigo-600 text-xs font-black uppercase tracking-widest group-hover:gap-2 transition-all">Iniciar <ArrowRightLeft size={14} className="ml-2" /></div></div>
                  </div>
                  <div onClick={() => { setView('board'); setSpreadType('mesa-9'); setIsManualMode(false); }} className="group relative bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-purple-500 transition-all cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col h-full"><div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform"><Grid3x3 size={28} /></div><h3 className="text-xl font-cinzel font-bold text-slate-900 mb-2">Quadrado de 9</h3><p className="text-xs text-slate-500 leading-relaxed mb-6">Leitura objetiva e focal. Perfeita para perguntas específicas e respostas diretas.</p><div className="mt-auto flex items-center text-purple-600 text-xs font-black uppercase tracking-widest group-hover:gap-2 transition-all">Iniciar <ArrowRightLeft size={14} className="ml-2" /></div></div>
                  </div>
                  <div onClick={() => { setView('board'); setSpreadType('relogio'); setIsManualMode(false); }} className="group relative bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-amber-500 transition-all cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col h-full"><div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform"><Clock size={28} /></div><h3 className="text-xl font-cinzel font-bold text-slate-900 mb-2">Relógio Cigano</h3><p className="text-xs text-slate-500 leading-relaxed mb-6">Jornada cíclica de 12 meses. Explore tendências mensais e evolução temporal.</p><div className="mt-auto flex items-center text-amber-600 text-xs font-black uppercase tracking-widest group-hover:gap-2 transition-all">Iniciar <ArrowRightLeft size={14} className="ml-2" /></div></div>
                  </div>
               </div>
            </div>
          )}

          {view === 'board' && (
            <>
              {/* Board Zoom Controls & Area (Mantido) */}
              <div className="absolute bottom-10 right-10 flex flex-col items-end gap-3 z-50">
                <div className={`flex flex-col gap-3 transition-all duration-300 transform origin-bottom ${zoomMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                  <button onClick={handleZoomIn} className={`p-3 rounded-full border shadow-2xl transition-all hover:scale-110 active:scale-95 bg-white border-slate-200 text-indigo-700 hover:bg-indigo-600 hover:text-white`}><ZoomIn size={22} /></button>
                  <button onClick={handleZoomOut} className={`p-3 rounded-full border shadow-2xl transition-all hover:scale-110 active:scale-95 bg-white border-slate-200 text-indigo-700 hover:bg-indigo-600 hover:text-white`}><ZoomOut size={22} /></button>
                  <button onClick={handleResetZoom} className={`p-3 rounded-full border shadow-2xl transition-all hover:scale-110 active:scale-95 bg-white border-slate-200 text-indigo-700 hover:bg-indigo-600 hover:text-white`}><Maximize2 size={22} /></button>
                  <div className={`mt-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400`}>{Math.round(zoomLevel * 100)}%</div>
                </div>
                <button onClick={() => setZoomMenuOpen(!zoomMenuOpen)} className={`p-4 rounded-full border shadow-2xl transition-all hover:scale-105 active:scale-95 ${zoomMenuOpen ? 'bg-rose-600 border-rose-500' : 'bg-indigo-600 border-indigo-500'} text-white`}>{zoomMenuOpen ? <X size={24} /> : <ZoomIn size={24} />}</button>
              </div>

              <div ref={boardRef} className="flex-grow flex flex-col items-center justify-start min-h-0 w-full py-10 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth">
                <div className="flex flex-col items-center w-full transition-all duration-500" style={{ minHeight: `${unscaledHeight * zoomLevel}px` }}>
                  {spreadType === 'mesa-real' ? (
                    <div ref={contentRef} className="max-w-6xl w-full grid grid-cols-8 gap-2 md:gap-4 mx-auto transition-all duration-300 flex-grow-0" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                      {board.slice(0, 32).map((id, i) => <CardVisual key={`real-${i}-${id}`} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i + 1} isSelected={selectedHouse === i} isThemeCard={false} highlightType={getGeometryHighlight(i)} onClick={() => handleHouseSelection(i)} isManualMode={isManualMode} spreadType="mesa-real" studyModeActive={studyMode.active} isAnimating={isAnimating} />)}
                      <div className="col-span-8 flex justify-center py-2 md:py-4"><span className="text-[9px] md:text-[11px] font-cinzel font-black tracking-[0.6em] text-slate-500 uppercase opacity-60">VEREDITO</span></div>
                      <div className="col-span-2"></div>
                      {board.slice(32, 36).map((id, i) => <CardVisual key={`real-${i+32}-${id}`} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i + 33} isSelected={selectedHouse === i+32} isThemeCard={false} highlightType={getGeometryHighlight(i+32)} onClick={() => handleHouseSelection(i+32)} isManualMode={isManualMode} spreadType="mesa-real" studyModeActive={studyMode.active} isAnimating={isAnimating} />)}
                    </div>
                  ) : spreadType === 'mesa-9' ? (
                    <div ref={contentRef} className="max-w-2xl w-full grid grid-cols-3 gap-2 md:gap-4 mx-auto transition-all duration-300 flex-grow-0" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                      {board.slice(0, 9).map((id, i) => <CardVisual key={`mini-${i}-${id}`} card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i + 1} isSelected={selectedHouse === i} isThemeCard={i === 4} themeColor="rgba(168, 85, 247, 0.5)" highlightType={getGeometryHighlight(i)} onClick={() => handleHouseSelection(i)} isManualMode={isManualMode} spreadType="mesa-9" studyModeActive={studyMode.active} isAnimating={isAnimating} />)}
                    </div>
                  ) : (
                    <div ref={contentRef} className="flex items-center justify-center flex-grow min-h-0 w-full py-10 origin-top transition-all" style={{ transform: `scale(${zoomLevel})` }}>
                      <div className={`relative w-[28rem] h-[28rem] md:w-[32rem] md:h-[32rem] border rounded-full flex items-center justify-center border-slate-200`}>
                        <div className="absolute w-28 z-20"><CardVisual key={`clock-center-${board[12]}`} card={board[12] ? LENORMAND_CARDS.find(c => c.id === board[12]) : null} houseId={13} isSelected={selectedHouse === 12} isThemeCard={false} highlightType={getGeometryHighlight(12)} onClick={() => handleHouseSelection(12)} isManualMode={isManualMode} spreadType="relogio" studyModeActive={studyMode.active} isAnimating={isAnimating} /></div>
                        {board.slice(0, 12).map((id, i) => {
                          const angle = (i * 30) - 90; const rad = angle * Math.PI / 180; const ox = 40 * Math.cos(rad); const oy = 40 * Math.sin(rad);
                          return (
                            <div key={`clock-house-${i}-${id}`} className="absolute w-24 aspect-[3/4.2] -translate-x-1/2 -translate-y-1/2 z-10 overflow-visible" style={{ left: `${50 + ox}%`, top: `${50 + oy}%` }}>
                              <CardVisual card={id ? LENORMAND_CARDS.find(c => c.id === id) : null} houseId={i + 1} isSelected={selectedHouse === i} isThemeCard={false} highlightType={getGeometryHighlight(i)} onClick={() => handleHouseSelection(i)} isManualMode={isManualMode} spreadType="relogio" offsetX={`${ox * 8}px`} offsetY={`${oy * 8}px`} studyModeActive={studyMode.active} isAnimating={isAnimating} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {view === 'glossary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {LENORMAND_CARDS.map(card => (
                <div key={card.id} className={`bg-white border-slate-200 text-slate-900 shadow-lg border rounded-2xl p-6 hover:border-indigo-500/50 transition-colors flex flex-col h-full`}>
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-16 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                      <img src={CARD_IMAGES[card.id] || FALLBACK_IMAGE} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h3 className="text-sm font-cinzel font-bold">{card.id}. {card.name}</h3>
                      <div className="flex items-center gap-2">
                         <span className={`text-[8px] font-black uppercase ${card.polarity === Polarity.POSITIVE ? 'text-emerald-500' : card.polarity === Polarity.NEGATIVE ? 'text-rose-500' : 'text-slate-500'}`}>{card.polarity}</span>
                         <span className="text-[8px] text-slate-400 border-l border-slate-300 pl-2">{card.suit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-4 flex-grow">
                     <div>
                       <h4 className="text-[10px] font-black uppercase text-indigo-600 mb-1">Mensagem Geral</h4>
                       <p className="text-[11px] text-slate-600 leading-relaxed italic">"{card.briefInterpretation}"</p>
                     </div>
                     
                     {/* Detailed Sections (Sincronização) */}
                     <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100">
                        {card.interpretationAtOrigin && (
                          <div><span className="text-[9px] font-bold text-slate-900 uppercase flex items-center gap-1"><Sparkles size={10}/> Futuro</span><p className="text-[10px] text-slate-500 leading-snug">{card.interpretationAtOrigin}</p></div>
                        )}
                        {card.amor && (
                          <div><span className="text-[9px] font-bold text-rose-600 uppercase flex items-center gap-1"><Heart size={10}/> Amor</span><p className="text-[10px] text-slate-500 leading-snug">{card.amor}</p></div>
                        )}
                        {card.trabalho && (
                          <div><span className="text-[9px] font-bold text-blue-600 uppercase flex items-center gap-1"><Briefcase size={10}/> Trabalho</span><p className="text-[10px] text-slate-500 leading-snug">{card.trabalho}</p></div>
                        )}
                        {card.dinheiro && (
                          <div><span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1"><Coins size={10}/> Dinheiro</span><p className="text-[10px] text-slate-500 leading-snug">{card.dinheiro}</p></div>
                        )}
                        {card.conselhos && (
                          <div className="bg-amber-50 p-2 rounded-lg border border-amber-100"><span className="text-[9px] font-bold text-amber-700 uppercase flex items-center gap-1"><Lightbulb size={10}/> Conselho</span><p className="text-[10px] text-amber-900/80 leading-snug italic">{card.conselhos}</p></div>
                        )}
                     </div>
                  </div>

                  {/* Footer Characteristics */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                     <div className="flex flex-wrap gap-1">
                       {card.keywords.map((k, i) => <span key={i} className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase bg-slate-100 text-slate-600`}>{k}</span>)}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {view === 'fundamentals' && (
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
              {FUNDAMENTALS_DATA.map(mod => (
                <div key={mod.id} className="space-y-6">
                  <div><h3 className={`text-xl font-cinzel font-bold text-indigo-950`}>{mod.title}</h3><p className="text-slate-400 text-sm">{mod.description}</p><p className="text-slate-500 text-xs mt-1 italic">{mod.content}</p></div>
                  <div className="grid gap-4">{mod.concepts.map((concept, i) => <ConceptAccordion key={`${mod.id}-c-${i}`} concept={concept} isOpen={openConceptId === `${mod.id}-c-${i}`} onToggle={() => setOpenConceptId(openConceptId === `${mod.id}-c-${i}` ? null : `${mod.id}-c-${i}`)} />)}</div>
                </div>
              ))}
            </div>
          )}
          {view === 'study' && (
            <div className="max-w-6xl mx-auto space-y-12 pb-20">
              <div className="text-center mb-12">
                <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500"><GraduationCap size={40} /></div>
                <h2 className={`text-3xl font-cinzel font-bold mb-4 text-indigo-950`}>Laboratório de Estudos LUMINA</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">Explore a teoria aplicada. Escolha um tópico abaixo para aprender a técnica e clique em "Ver na Prática" para visualizar os destaques nos tabuleiros reais.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {FUNDAMENTALS_DATA.map((mod) => (
                  <div key={`study-${mod.id}`} className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-indigo-500/20 pb-4">
                      {mod.id === 'f_mesa_real' ? <LayoutGrid className="text-indigo-500" /> : mod.id === 'f_mesa_9' ? <Grid3x3 className="text-indigo-500" /> : <Clock className="text-indigo-500" />}
                      <h3 className={`text-xl font-cinzel font-bold text-indigo-950`}>{mod.title}</h3>
                    </div>
                    <div className="grid gap-4">
                      {mod.concepts.map((concept, i) => (
                        <ConceptAccordion key={`study-concept-${concept.id || i}`} concept={concept} isOpen={openConceptId === `study-${mod.id}-${i}`} onToggle={() => setOpenConceptId(openConceptId === `study-${mod.id}-${i}` ? null : `study-${mod.id}-${i}`)} onPractice={() => handlePracticeMode(concept.id || concept.title.toLowerCase().split(' ').join('-'), concept.practiceTarget || (mod.id === 'f_mesa_real' ? 'mesa-real' : mod.id === 'f_mesa_9' ? 'mesa-9' : 'relogio'))} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === 'profile' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              <div className={`bg-white border-slate-200 shadow-xl border rounded-[2.5rem] p-10 text-center relative`}>
                <div className="relative w-24 h-24 mx-auto mb-6 group">
                   {userPhoto ? <img src={userPhoto} alt="Perfil" className="w-full h-full rounded-full object-cover shadow-2xl border-4 border-indigo-50" /> : <div className="w-full h-full rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-cinzel font-bold shadow-2xl border-4 border-indigo-50">{userName.charAt(0).toUpperCase()}</div>}
                   <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white"><Camera size={24} /><input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handlePhotoUpload} /></label>
                </div>
                <div className="flex items-center justify-center gap-3 mb-2">
                  {isEditingProfile ? (<div className="flex items-center gap-2"><input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="border-b-2 border-indigo-500 text-2xl font-cinzel font-bold text-slate-950 text-center focus:outline-none bg-transparent" autoFocus /><button onClick={handleProfileNameSave} className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><CheckCircle2 size={18} /></button></div>) : (<><h3 className={`text-2xl font-cinzel font-bold text-slate-950`}>{userName}</h3><button onClick={() => { setIsEditingProfile(true); setTempName(userName); }} className={`p-1.5 rounded-lg transition-colors text-slate-400 hover:text-indigo-600`}><Edit3 size={18} /></button></>)}
                </div>
                <p className={`font-bold uppercase text-[10px] tracking-[0.3em] mt-1 text-indigo-600`}>Nível Iniciante • {savedReadings.length} Tiragens</p>
                <div className="grid grid-cols-3 gap-4 mt-10">
                  {[ { label: 'Tiragens', val: savedReadings.length, icon: <History size={16}/> }, { label: 'Cartas Vistas', val: '36/36', icon: <Layers size={16}/> }, { label: 'Pontuação', val: '450', icon: <Award size={16}/> } ].map((stat, i) => (
                    <div key={i} className={`bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm`}><div className="text-indigo-600 mb-2 flex justify-center">{stat.icon}</div><div className={`text-lg font-bold text-slate-900`}>{stat.val}</div><div className="text-[8px] font-black uppercase text-slate-500">{stat.label}</div></div>
                  ))}
                </div>
              </div>
              <div className={`bg-white border-slate-200 shadow-lg border rounded-[2rem] p-8`}>
                 <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500"><ShieldCheck size={20}/></div><h4 className={`font-cinzel font-bold text-sm uppercase tracking-widest text-slate-900`}>Informações de Licença</h4></div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Tipo de Licença</span><div className={`text-sm font-bold text-indigo-700`}>{accessType === 'trial' ? "Modo Degustação" : accessType === 'full' ? "Plano Vitalício (Premium)" : "Sem Acesso"}</div></div>
                    <div className="space-y-1"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Data de Início</span><div className={`text-sm font-bold text-slate-700`}>15 de Dezembro, 2023</div></div>
                    <div className="space-y-1"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">E-mail Cadastrado</span><div className={`text-sm font-bold text-slate-700`}>estudante@lumina.com</div></div>
                 </div>
              </div>
              {accessType === 'full' ? (
                <div className={`bg-white border-slate-200 shadow-lg border rounded-[2rem] p-8`}>
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500"><History size={20}/></div><h4 className={`font-cinzel font-bold text-sm uppercase tracking-widest text-slate-900`}>Minhas Tiragens Salvas</h4></div>
                     <div className="flex items-center gap-4">
                       <button onClick={() => setIsExcludingReadings(!isExcludingReadings)} className={`text-[10px] font-black uppercase transition-colors flex items-center gap-1.5 ${isExcludingReadings ? 'text-rose-500' : 'text-indigo-500'} hover:underline`}>{isExcludingReadings ? <><CheckCircle2 size={12}/> Concluir</> : <><Edit3 size={12}/> Editar</>}</button>
                     </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedReadings.map(reading => (
                        <div key={reading.id} onClick={() => !isExcludingReadings && handleLoadReading(reading)} className={`p-4 rounded-2xl border flex items-center justify-between group cursor-pointer transition-all bg-slate-50 border-slate-100 hover:border-indigo-300`}>
                          <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white border`}>{reading.type === 'mesa-real' ? <LayoutGrid size={20} className="text-indigo-400"/> : <Clock size={20} className="text-amber-400"/>}</div><div><div className={`text-sm font-bold text-slate-900`}>{reading.title}</div><div className="text-[10px] text-slate-500">Salvo em {reading.date}</div></div></div>
                          <button onClick={(e) => { e.stopPropagation(); if (isExcludingReadings) handleDeleteReading(reading.id); }} className={`p-2 rounded-lg transition-colors ${isExcludingReadings ? 'text-rose-500 hover:bg-rose-500/10' : 'group-hover:bg-indigo-600 group-hover:text-white text-slate-500 shadow-sm'}`}>{isExcludingReadings ? <Trash2 size={18} /> : <ChevronRight size={18} />}</button>
                        </div>
                      ))}
                      {savedReadings.length === 0 && <div className="col-span-2 py-8 text-center opacity-40"><p className="text-sm">Nenhuma leitura salva.</p></div>}
                   </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 text-center opacity-60">
                   <Lock className="mx-auto mb-2 text-slate-400" size={24} />
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Histórico indisponível no Modo Degustação</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Picker (Mantido) */}
        {showCardPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="max-w-4xl w-full max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 custom-scrollbar">
              <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4"><h3 className="text-sm font-cinzel font-bold text-indigo-100">Escolha a Carta para Casa {selectedHouse! + 1}</h3><button onClick={() => setShowCardPicker(false)} className="p-2 text-slate-500 hover:text-white"><X size={24}/></button></div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-3">
                {LENORMAND_CARDS.map(card => {
                  const isUsed = board.includes(card.id);
                  return (
                    <div key={card.id} onClick={() => { const newBoard = [...board]; const prevIdx = newBoard.indexOf(card.id); if(prevIdx !== -1) newBoard[prevIdx] = null; newBoard[selectedHouse!] = card.id; setBoard(newBoard); setShowCardPicker(false); }} className={`aspect-[3/4.2] rounded-xl border-2 flex flex-col items-center justify-center p-2 cursor-pointer transition-all ${isUsed ? 'opacity-40 grayscale pointer-events-none' : 'border-slate-700 hover:border-indigo-500 bg-slate-800/60'}`}><span className="text-[10px] font-black text-slate-400">{card.id}</span><span className="text-[7px] font-bold text-center uppercase tracking-tighter mt-1 text-indigo-200">{card.name}</span></div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mentor Panel - ATUALIZADO */}
      <aside className={`fixed md:sticky top-0 inset-y-0 right-0 z-[70] md:z-30 h-screen transition-all duration-500 border-l flex flex-col overflow-hidden ${mentorPanelOpen ? 'w-full md:w-[32rem]' : 'w-16'} bg-white border-slate-200`}>
        {!mentorPanelOpen && <div className="flex flex-col items-center py-8 h-full w-16 cursor-pointer" onClick={() => setMentorPanelOpen(true)}><ChevronLeft size={20} className="text-slate-500" /><span className="font-cinzel text-[11px] font-bold uppercase tracking-[0.5em] rotate-[-90deg] origin-center py-12 text-slate-500">MENTOR</span></div>}
        {mentorPanelOpen && (
          <>
            <div className={`p-4 border-b flex items-center justify-between shadow-lg h-16 shrink-0 bg-slate-50 border-slate-200`}><button onClick={() => setMentorPanelOpen(false)} className={`p-2 transition-colors text-slate-500 hover:text-slate-950`}><ChevronRight size={18} /></button><h2 className={`text-xs font-bold font-cinzel uppercase tracking-[0.2em] text-indigo-950 font-black`}>Mentor LUMINA</h2><div className="w-10"></div></div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
              {selectedHouse !== null && board[selectedHouse] ? (
                <>
                  <div className={`p-6 rounded-3xl border shadow-lg bg-white border-slate-200 flex items-center gap-6`}>
                    <div className="w-16 md:w-20 aspect-[3/4.2] rounded-xl overflow-hidden border border-slate-700 shrink-0 shadow-lg"><img src={CARD_IMAGES[selectedCard?.id] || FALLBACK_IMAGE} className="w-full h-full object-cover" alt="" /></div>
                    <div className="flex-grow"><span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1 block">CASA {selectedHouse + (spreadType === 'relogio' && selectedHouse < 12 ? 101 : spreadType === 'relogio' ? 113 : 1)}: {currentHouse?.name}</span><h3 className={`text-xl font-cinzel font-bold mb-2 text-slate-950`}>{selectedCard?.name}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${selectedCard?.polarity === Polarity.POSITIVE ? 'bg-emerald-500' : selectedCard?.polarity === Polarity.NEGATIVE ? 'bg-rose-500' : 'bg-slate-400'}`} /><span className={`text-[10px] font-black uppercase text-slate-950`}>{selectedCard?.polarity}</span></div>
                        {selectedCard?.timingSpeed !== Timing.UNCERTAIN && (
                          <div className="flex items-center gap-1.5 text-slate-500"><Clock size={12}/><span className={`text-[10px] font-black uppercase text-slate-800 font-bold`}>{selectedCard?.timingSpeed}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Base Meanings */}
                  <div className="space-y-4">
                    <div className={`p-4 rounded-2xl border bg-indigo-50 border-indigo-100 shadow-sm`}>
                      <span className="text-[11px] font-black uppercase text-indigo-600 mb-2 block">Mensagem Geral</span>
                      <p className={`text-[13px] leading-relaxed text-slate-900 font-medium`}>"{selectedCard?.briefInterpretation}"</p>
                    </div>
                    {selectedCard?.interpretationAtOrigin && (
                      <div className={`p-4 rounded-2xl border bg-slate-50 border-slate-100 shadow-sm`}>
                        <span className="text-[11px] font-black uppercase text-slate-600 mb-2 block">Futuro & Tendência</span>
                        <p className={`text-[13px] leading-relaxed text-slate-800`}>{selectedCard?.interpretationAtOrigin}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">{selectedCard?.keywords.map((k, i) => <span key={i} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-700 font-bold`}>{k}</span>)}</div>
                  </div>

                  {/* Rich Contexts (Amor, Trabalho, Dinheiro) */}
                  <div className="space-y-4">
                    <h4 className={`text-[12px] font-black uppercase text-indigo-600 tracking-[0.3em] border-b pb-2 border-slate-200 mt-6`}>CONTEXTOS ESPECÍFICOS</h4>
                    
                    {selectedCard?.amor && (
                      <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0"><Heart size={16} /></div>
                        <div><h5 className="text-[11px] font-black uppercase text-slate-900 mb-1">Amor & Relacionamentos</h5><p className="text-[12px] text-slate-600 leading-snug">{selectedCard.amor}</p></div>
                      </div>
                    )}
                    
                    {selectedCard?.trabalho && (
                      <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0"><Briefcase size={16} /></div>
                        <div><h5 className="text-[11px] font-black uppercase text-slate-900 mb-1">Trabalho & Carreira</h5><p className="text-[12px] text-slate-600 leading-snug">{selectedCard.trabalho}</p></div>
                      </div>
                    )}

                    {selectedCard?.dinheiro && (
                      <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"><Coins size={16} /></div>
                        <div><h5 className="text-[11px] font-black uppercase text-slate-900 mb-1">Dinheiro & Finanças</h5><p className="text-[12px] text-slate-600 leading-snug">{selectedCard.dinheiro}</p></div>
                      </div>
                    )}

                    {selectedCard?.conselhos && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                         <div className="flex items-center gap-2 mb-2 text-amber-700 font-black uppercase text-[11px] tracking-widest"><Lightbulb size={14} /> Conselho do Oráculo</div>
                         <p className="text-[12px] text-slate-800 leading-relaxed font-medium italic">"{selectedCard.conselhos}"</p>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* History Section (Mantido) */}
              {spreadType === 'relogio' && (isViewingFirstDraw ? secondDrawHistoryData : firstDrawHistoryData) && (
                <div className="space-y-4 animate-in slide-in-from-right duration-500 mt-8">
                  <h4 className={`text-[12px] font-black uppercase text-indigo-600 tracking-[0.3em] border-b pb-2 border-slate-200`}>{isViewingFirstDraw ? "HISTÓRICO DA 2ª TIRAGEM" : "HISTÓRICO DA 1ª TIRAGEM"}</h4>
                  <div className="grid gap-3">
                     {(isViewingFirstDraw ? secondDrawHistoryData! : firstDrawHistoryData!).map((item, i) => (
                       <div key={i} className={`p-3 rounded-xl border bg-slate-50 border-slate-200 shadow-sm`}>
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-10 rounded border border-white/10 overflow-hidden shrink-0 shadow-sm"><img src={CARD_IMAGES[item.card?.id] || FALLBACK_IMAGE} className="w-full h-full object-cover" alt="" /></div>
                             <div className="flex-grow">
                                <div className="flex justify-between items-center mb-0.5"><span className={`text-[11px] font-bold text-slate-950`}>{item.card?.name}</span><span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{item.house?.name}</span></div>
                                <p className={`text-[10px] italic leading-snug text-slate-700`}>"{item.card?.briefInterpretation}"</p>
                             </div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              )}

              {/* Geometry Section (Mantido) */}
              {selectedHouse !== null && board[selectedHouse] ? (
                <div className="space-y-6 mt-8">
                  <h4 className={`text-[12px] font-black uppercase text-indigo-600 tracking-[0.3em] border-b pb-2 border-slate-200`}>GEOMETRIA ESTRUTURAL</h4>
                  {spreadType === 'mesa-real' && (
                    <div className="grid gap-4">
                      {bridgeData && (
                        <div className={`p-4 rounded-2xl border bg-amber-50 border-amber-200 shadow-sm`}>
                          <h5 className="text-[13px] font-black text-amber-700 uppercase flex items-center gap-2 mb-2"><GitMerge size={12}/> Técnica da Ponte</h5>
                          <p className={`text-[13px] leading-snug text-slate-900`}>O dono da Casa {selectedHouse + 1} ({currentHouse?.name}) está na <span className={`font-bold text-slate-950 underline decoration-indigo-300`}>Casa {bridgeData.houseId} ({bridgeData.house.name})</span> com a carta <span className={`font-bold text-slate-950`}>{bridgeData.card?.name}</span>.</p>
                          <p className={`text-[11px] italic mt-1 text-slate-800`}>"{bridgeData.card?.briefInterpretation}"</p>
                        </div>
                      )}
                      {knightData.length > 0 && (
                        <div className={`p-4 rounded-2xl border bg-fuchsia-50 border-fuchsia-200 shadow-sm`}>
                          <h5 className="text-[13px] font-black text-fuchsia-800 uppercase flex items-center gap-2 mb-3"><CornerDownRight size={12}/> Salto do Cavalo</h5>
                          <div className="space-y-2">
                            {knightData.map((item, i) => (
                              <div key={i} className={`bg-white border-slate-200 shadow-sm p-2 rounded-lg border`}>
                                <div className="flex justify-between items-center mb-1"><span className={`text-[13px] font-bold text-slate-950`}>{item.card?.name}</span><span className="text-[11px] text-slate-600 font-black uppercase">Casa {item.houseId}</span></div>
                                <p className={`text-[11px] italic leading-tight text-slate-800`}>"{item.card?.briefInterpretation}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(diagonalData.up.length > 0 || diagonalData.down.length > 0) && (
                        <div className={`p-4 rounded-2xl border bg-orange-50 border-orange-200 shadow-sm`}>
                          <h5 className="text-[13px] font-black text-orange-800 uppercase flex items-center gap-2 mb-3"><MoveDiagonal size={12}/> Eixos Diagonais</h5>
                          <div className="space-y-4">
                            {diagonalData.up.length > 0 && (
                              <div>
                                <span className="text-[11px] font-black text-orange-600 uppercase block mb-1">Campo de Ascensão (🔺):</span>
                                {diagonalData.up.map((i, idx) => (
                                  <div key={idx} className={`bg-white border border-slate-100 shadow-sm p-1.5 rounded mb-1`}><span className={`text-[13px] font-bold block text-slate-950`}>{i.card?.name} (C{i.houseId})</span><p className={`text-[11px] italic leading-tight mt-0.5 text-slate-800`}>"{i.card?.briefInterpretation}"</p></div>
                                ))}
                              </div>
                            )}
                            {diagonalData.down.length > 0 && (
                              <div>
                                <span className="text-[11px] font-black text-orange-600 uppercase block mb-1">Campo de Sustentação (🔻):</span>
                                {diagonalData.down.map((i, idx) => (
                                  <div key={idx} className={`bg-white border border-slate-100 shadow-sm p-1.5 rounded mb-1`}><span className={`text-[13px] font-bold block text-slate-950`}>{i.card?.name} (C{i.houseId})</span><p className={`text-[11px] italic leading-tight mt-0.5 text-slate-800`}>"{i.card?.briefInterpretation}"</p></div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {spreadType === 'relogio' && axisDataRelogio && (
                    <div className="grid gap-4">
                      {/* NOVA SESSÃO: DINÂMICA DO RELÓGIO (Temporalidade e Interação) */}
                      <div className={`p-4 rounded-2xl border bg-indigo-50 border-indigo-100 shadow-sm`}>
                        <h5 className="text-[13px] font-black text-indigo-800 uppercase flex items-center gap-2 mb-4"><Clock size={12}/> Dinâmica do Relógio</h5>
                        
                        {/* 1. Temporalidade */}
                        {currentHouse?.month && (
                          <div className="mb-4 pb-4 border-b border-indigo-200/50">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Temporalidade</span>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-bold text-indigo-950">{currentHouse.month}</span>
                              <span className="text-[10px] px-2 py-0.5 bg-white rounded border border-indigo-100 text-indigo-600 font-bold uppercase">{currentHouse.zodiac}</span>
                            </div>
                          </div>
                        )}

                        {/* 2. Influência Central */}
                        {board[12] && (
                          <div className="mb-4 pb-4 border-b border-indigo-200/50">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Filtro Regente (Centro)</span>
                            <div className="flex items-center gap-2">
                               <span className="text-[12px] font-bold text-indigo-950">{LENORMAND_CARDS.find(c => c.id === board[12])?.name}</span>
                               <span className="text-[10px] text-indigo-600/70 italic">modula esta casa</span>
                            </div>
                          </div>
                        )}

                        {/* 3. Interação Carta x Casa */}
                        <div className="mb-2">
                           <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Interação</span>
                           <p className="text-[11px] leading-snug text-slate-700">
                             A energia de <span className="font-bold text-indigo-900">{selectedCard?.name}</span> atua sobre o tema <span className="font-bold text-indigo-900">{currentHouse?.theme}</span>.
                           </p>
                        </div>
                      </div>

                      {/* Eixo de Oposição (Mantido, mas visualmente integrado) */}
                      <div className={`p-4 rounded-2xl border bg-white border-slate-200 shadow-sm`}>
                        <h5 className="text-[13px] font-black text-slate-700 uppercase flex items-center gap-2 mb-2"><Scale size={12}/> Eixo de Oposição (180°)</h5>
                        <p className={`text-[13px] font-bold mb-2 text-slate-900`}>{axisDataRelogio.axis?.name}</p>
                        <p className={`text-[11px] mb-4 text-slate-500 leading-snug`}>{axisDataRelogio.axis?.description}</p>
                        {axisDataRelogio.oppositeCard && (
                          <div className={`p-3 rounded-xl border animate-in fade-in duration-500 bg-slate-50 border-slate-200 shadow-inner`}>
                            <div className="flex justify-between items-center mb-1"><span className={`text-[11px] font-bold text-indigo-900`}>{axisDataRelogio.oppositeCard.name} (Oposição)</span><span className="text-[9px] text-slate-500 font-black uppercase">Casa {axisDataRelogio.oppositeHouseId}</span></div>
                            <p className={`text-[10px] italic leading-tight text-slate-600`}>"{axisDataRelogio.oppositeCard.briefInterpretation}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button onClick={runMentorAnalysis} disabled={isAiLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl mt-6">{isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}<span>EXPANDIR LEITURA (MENTOR IA)</span></button>
                  {cardAnalysis && <div className={`mt-4 rounded-3xl p-6 border shadow-2xl animate-in slide-in-from-bottom-4 duration-700 bg-white border-slate-200`}><div className={`prose prose-sm text-[12px] font-inter leading-relaxed whitespace-pre-wrap text-slate-950`}>{cardAnalysis}</div></div>}
                </div>
              ) : (
                !firstDrawHistoryData && <div className="h-full flex flex-col items-center justify-center text-center opacity-20 p-8"><Compass size={64} className="mb-6 animate-pulse" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Selecione uma casa ocupada no laboratório.</p></div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

export default App;