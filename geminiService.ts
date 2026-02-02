import { GoogleGenAI } from "@google/genai";
import { LENORMAND_CARDS, LENORMAND_HOUSES } from "./constants";
import { SpreadType, StudyLevel, ReadingTheme } from "./types";
import * as Geometry from "./geometryService";

const getCardName = (id: number | null) => {
  if (id === null) return "Vazio";
  return LENORMAND_CARDS.find(c => c.id === id)?.name || "Desconhecido";
};

export const getDetailedCardAnalysis = async (
  boardState: (number | null)[], 
  selectedIndex: number, 
  theme: ReadingTheme = 'Geral',
  spreadType: SpreadType = 'mesa-real',
  level: StudyLevel = 'Iniciante'
) => {
  // Use a variável de ambiente correta conforme seu framework (ex: VITE_API_KEY ou NEXT_PUBLIC_...)
  const apiKey = process.env.API_KEY || "";
  if (!apiKey) return "Configuração de API pendente.";
  
  const selectedCardId = boardState[selectedIndex];
  if (selectedCardId === null) return "Selecione uma casa ocupada para análise.";

  const card = LENORMAND_CARDS.find(c => c.id === selectedCardId);
  
  // CORREÇÃO: Busca dinâmica da casa baseada no Spread
  let house;
  if (spreadType === 'relogio') {
    house = LENORMAND_HOUSES.find(h => h.id === (101 + selectedIndex));
  } else if (spreadType === 'templo-afrodite') {
    house = LENORMAND_HOUSES.find(h => h.id === (201 + selectedIndex));
  } else {
    // Mesa Real e Mesa de 9 usam as casas padrão 1-36 (índices 0-35)
    house = LENORMAND_HOUSES[selectedIndex];
  }

  if (!house) return "Erro ao localizar contexto da casa.";

  let geometries: any = {};

  if (spreadType === 'mesa-real') {
    const bridgeIndex = boardState.findIndex(id => id === (selectedIndex + 1));
    geometries = {
        ponte_causa_raiz: {
          target_card: bridgeIndex !== -1 ? getCardName(boardState[bridgeIndex]) : null,
          target_house: bridgeIndex !== -1 ? LENORMAND_HOUSES[bridgeIndex]?.name : null
        },
        molduras: [0, 7, 24, 31].map(idx => getCardName(boardState[idx])),
        veredito: boardState.slice(32, 36).map(id => getCardName(id)),
        diagonais: {
            ascendente: Geometry.getDiagonaisSuperiores(selectedIndex).map(idx => getCardName(boardState[idx])),
            descendente: Geometry.getDiagonaisInferiores(selectedIndex).map(idx => getCardName(boardState[idx]))
        }
    };
  } else if (spreadType === 'relogio') {
    geometries = {
        temporal_context: { month: house.month, zodiac: house.zodiac },
        central_regent: getCardName(boardState[12]),
        oposicao_direta: getCardName(boardState[Geometry.getOposicaoRelogio(selectedIndex)])
    };
  } else if (spreadType === 'templo-afrodite') {
    // MAPEAMENTO ÓTIMO: Organiza por níveis para a IA comparar
    geometries = {
      niveis_comparativos: {
        mental: { ele: getCardName(boardState[0]), voce: getCardName(boardState[1]) },
        afetivo: { ele: getCardName(boardState[2]), voce: getCardName(boardState[3]) },
        instintivo: { ele: getCardName(boardState[4]), voce: getCardName(boardState[5]) }
      },
      sintese_relacionamento: getCardName(boardState[6]),
      posicao_clicada: selectedIndex % 2 === 0 ? "Lado dele/a (Coluna A)" : "Seu lado (Coluna B)"
    };
  }

  const context = {
    spreadType,
    level,
    selected: { 
        card: card?.name, 
        house: house.name, 
        house_theme: house.theme,
        timing: card?.timingSpeed
    },
    theme,
    geometries
  };

  const prompt = `
    Você é o Mentor Virtual LUMINA (Baralho Cigano). 
    Gere uma análise pedagógica nível ${level} para o tema "${theme}".
    
    TIPO DE JOGO: ${spreadType.toUpperCase()}
    CONTEXTO ATUAL: ${JSON.stringify(context, null, 2)}
    
    ESTRUTURA:
    1. **O Momento (Tempo)**: Use a velocidade "${card?.timingSpeed}" para explicar o ritmo da situação.
    2. **Foco na Casa ${house.name}**: Como a carta ${card?.name} se manifesta aqui?
    3. **Conexões Geométricas**: 
       ${spreadType === 'templo-afrodite' ? 'Compare o nível atual entre as duas pessoas.' : 'Use as diagonais/pontes fornecidas.'}
    4. **Veredito do Mentor**: Uma síntese de impacto.
    5. **Exercício**: Uma pergunta reflexiva para o estudante.
  `;

  const ai = new GoogleGenAI(apiKey);
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // Recomendo o flash para velocidade/custo
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return "O Mentor Lumina está meditando. Tente novamente em breve.";
  }
};