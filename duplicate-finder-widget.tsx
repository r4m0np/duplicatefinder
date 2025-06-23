import { usePlugin, renderWidget, useTracker } from '@remnote/plugin-sdk';
import React, { useState, useEffect } from 'react';

// Interfaces para os tipos de dados
interface Card {
  id: string;
  frontText: string;
  backText: string;
  rem: any; // Objeto Rem do RemNote
  tags: string[];
}

interface DuplicatePair {
  card1: Card;
  card2: Card;
  similarity: number;
}

interface DuplicatesResult {
  exactMatches: DuplicatePair[];
  frontMatches: DuplicatePair[];
  similarCards: DuplicatePair[];
}

// Componente principal do widget
export const DuplicateFinderWidget = () => {
  const plugin = usePlugin();
  const [isLoading, setIsLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatesResult>({
    exactMatches: [],
    frontMatches: [],
    similarCards: []
  });
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');

  // Obter configurações do plugin
  const similarityThreshold = useTracker(async () => 
    await plugin.settings.getSetting('similarity-threshold') as number
  ) || 0.75;
  
  const checkFrontOnly = useTracker(async () => 
    await plugin.settings.getSetting('check-front-only') as boolean
  ) || false;
  
  const enableFuzzySearch = useTracker(async () => 
    await plugin.settings.getSetting('enable-fuzzy-search') as boolean
  ) || true;
  
  const blacklistTags = useTracker(async () => {
    const tags = await plugin.settings.getSetting('blacklist-tags') as string;
    return tags.split(',').map(tag => tag.trim());
  }) || [];

  useEffect(() => {
    setBlacklist(blacklistTags);
  }, [blacklistTags]);

  // Função para normalizar texto (remover acentos, pontuação e converter para minúsculas)
  const normalizeText = (text: string): string => {
    if (!text) return '';
    
    // Remover formatação rich text (simplificado)
    let plainText = text;
    if (typeof text !== 'string') {
      try {
        // Tenta extrair texto de rich text do RemNote
        plainText = JSON.stringify(text);
      } catch (e) {
        plainText = '';
      }
    }
    
    // Remover acentos (simplificado)
    const replacements: {[key: string]: string} = {
      'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
      'é': 'e', 'ê': 'e',
      'í': 'i', 'î': 'i',
      'ó': 'o', 'ô': 'o', 'õ': 'o',
      'ú': 'u', 'û': 'u',
      'ç': 'c'
    };
    
    plainText = plainText.toLowerCase();
    for (const [old, newChar] of Object.entries(replacements)) {
      plainText = plainText.replace(new RegExp(old, 'g'), newChar);
    }
    
    // Remover pontuação e múltiplos espaços
    plainText = plainText.replace(/[^\w\s]/g, '');
    plainText = plainText.replace(/\s+/g, ' ');
    return plainText.trim();
  };

  // Calcular similaridade entre dois textos
  const calculateSimilarity = (text1: string, text2: string): number => {
    if (!enableFuzzySearch) {
      return normalizeText(text1) === normalizeText(text2) ? 1.0 : 0.0;
    }
    
    // Normalizar os textos
    const norm1 = normalizeText(text1);
    const norm2 = normalizeText(text2);
    
    if (!norm1 || !norm2) return 0;
    
    // Algoritmo simplificado de similaridade (distância de Levenshtein)
    const levenshtein = (a: string, b: string): number => {
      const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
      
      for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
      for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
      
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,         // Deleção
            matrix[i][j - 1] + 1,         // Inserção
            matrix[i - 1][j - 1] + cost   // Substituição
          );
        }
      }
      
      return matrix[a.length][b.length];
    };
    
    // Similaridade normalizada
    const maxLength = Math.max(norm1.length, norm2.length);
    if (maxLength === 0) return 1.0; // Ambos strings vazios
    
    const distance = levenshtein(norm1, norm2);
    return 1 - (distance / maxLength);
  };

  // Buscar todos os flashcards
  const fetchAllCards = async () => {
    setIsLoading(true);
    try {
      // Usar a API de busca do RemNote para encontrar todos os Rems
      const allRems = await plugin.rem.findAll();
      
      // Filtrar apenas os Rems que são flashcards
      const cards: Card[] = [];
      
      for (const rem of allRems) {
        try {
          // Verificar se é um flashcard
          const cards = await rem.getCards();
          if (cards && cards.length > 0) {
            // Obter tags
            const tags: string[] = [];
            const powerups = await rem.getPowerups();
            for (const powerup of powerups) {
              const name = await powerup.getName();
              tags.push(name);
            }
            
            // Verificar lista negra
            if (tags.some(tag => blacklist.includes(tag))) {
              continue;
            }
            
            // Obter texto
            const frontText = await rem.getText();
            const backText = await rem.getBackText();
            
            cards.push({
              id: rem._id,
              frontText: frontText ? JSON.stringify(frontText) : '',
              backText: backText ? JSON.stringify(backText) : '',
              rem: rem,
              tags: tags
            });
          }
        } catch (e) {
          // Ignorar erros de cartões individuais
          console.error('Erro ao processar cartão:', e);
        }
      }
      
      setAllCards(cards);
      
      // Analisar duplicatas
      await findDuplicates(cards);
    } catch (e) {
      console.error('Erro ao buscar cartões:', e);
      plugin.app.toast('Erro ao buscar cartões');
    } finally {
      setIsLoading(false);
    }
  };

  // Encontrar duplicatas
  const findDuplicates = async (cards: Card[]) => {
    const result: DuplicatesResult = {
      exactMatches: [],
      frontMatches: [],
      similarCards: []
    };
    
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const card1 = cards[i];
        const card2 = cards[j];
        
        // Verificar correspondência exata
        if (normalizeText(card1.frontText) === normalizeText(card2.frontText) && 
            (!checkFrontOnly && normalizeText(card1.backText) === normalizeText(card2.backText))) {
          result.exactMatches.push({
            card1,
            card2,
            similarity: 1.0
          });
          continue;
        }
        
        // Verificar correspondência apenas do front
        const frontSimilarity = calculateSimilarity(card1.frontText, card2.frontText);
        if (frontSimilarity >= 0.9) {
          result.frontMatches.push({
            card1,
            card2,
            similarity: frontSimilarity
          });
          continue;
        }
        
        // Verificar similaridade geral
        if (frontSimilarity >= similarityThreshold) {
          let combinedSimilarity = frontSimilarity;
          
          if (!checkFrontOnly) {
            const backSimilarity = calculateSimilarity(card1.backText, card2.backText);
            combinedSimilarity = (frontSimilarity + backSimilarity) / 2;
          }
          
          if (combinedSimilarity >= similarityThreshold) {
            result.similarCards.push({
              card1,
              card2,
              similarity: combinedSimilarity
            });
          }
        }
      }
    }
    
    setDuplicates(result);
  };
  
  // Marcar cartão como verificado
  const markAsVerified = async (card: Card) => {
    try {
      // Obter o PowerUp
      const powerup = await plugin.powerup.getPowerupByCode('verified-card');
      if (!powerup) return;
      
      // Aplicar o PowerUp ao Rem
      await card.rem.addPowerup(powerup);
      
      // Definir a data de verificação
      const date = new Date();
      await plugin.powerup.setPowerupProperty(
        card.rem._id,
        'verified-card',
        'verified-date',
        date.toISOString()
      );
      
      plugin.app.toast('Cartão marcado como verificado');
    } catch (e) {
      console.error('Erro ao marcar cartão:', e);
      plugin.app.toast('Erro ao marcar cartão');
    }
  };

  // Ignorar par duplicado
  const ignorePair = (pair: DuplicatePair, type: 'exact' | 'front' | 'similar') => {
    setDuplicates(prev => {
      switch (type) {
        case 'exact':
          return {
            ...prev,
            exactMatches: prev.exactMatches.filter(p => 
              !(p.card1.id === pair.card1.id && p.card2.id === pair.card2.id)
            )
          };
        case 'front':
          return {
            ...prev,
            frontMatches: prev.frontMatches.filter(p => 
              !(p.card1.id === pair.card1.id && p.card2.id === pair.card2.id)
            )
          };
        case 'similar':
          return {
            ...prev,
            similarCards: prev.similarCards.filter(p => 
              !(p.card1.id === pair.card1.id && p.card2.id === pair.card2.id)
            )
          };
      }
    });
  };

  // Mesclar dois cartões
  const mergeCards = async (pair: DuplicatePair) => {
    try {
      // Manter o primeiro cartão e remover o segundo
      await pair.card2.rem.remove();
      plugin.app.toast('Cartões mesclados com sucesso!');
      
      // Atualizar listas de duplicatas
      ignorePair(pair, 'exact');
      ignorePair(pair, 'front');
      ignorePair(pair, 'similar');
    } catch (e) {
      console.error('Erro ao mesclar cartões:', e);
      plugin.app.toast('Erro ao mesclar cartões');
    }
  };
  
  // Renderizar um cartão
  const renderCard = (card: Card) => {
    return (
      <div className="card">
        <div className="card-content">
          <div className="card-front">
            <strong>Front:</strong> {formatText(card.frontText)}
          </div>
          {!checkFrontOnly && (
            <div className="card-back">
              <strong>Back:</strong> {formatText(card.backText)}
            </div>
          )}
          <div className="card-tags">
            {card.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
        <div className="card-actions">
          <button 
            className="action-button view"
            onClick={() => plugin.window.openRem(card.id)}
          >
            Ver
          </button>
          <button 
            className="action-button verify"
            onClick={() => markAsVerified(card)}
          >
            Verificar
          </button>
        </div>
      </div>
    );
  };
  
  // Formatar texto para exibição
  const formatText = (text: string): string => {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  };
  
  // Filtrar duplicatas pelo texto
  const filterDuplicates = (pairs: DuplicatePair[]): DuplicatePair[] => {
    if (!filterText) return pairs;
    
    return pairs.filter(pair => 
      normalizeText(pair.card1.frontText).includes(normalizeText(filterText)) ||
      normalizeText(pair.card2.frontText).includes(normalizeText(filterText)) ||
      (!checkFrontOnly && (
        normalizeText(pair.card1.backText).includes(normalizeText(filterText)) ||
        normalizeText(pair.card2.backText).includes(normalizeText(filterText))
      ))
    );
  };
  
  // Contagens
  const exactCount = duplicates.exactMatches.length;
  const frontCount = duplicates.frontMatches.length;
  const similarCount = duplicates.similarCards.length;
  const totalCount = exactCount + frontCount + similarCount;
  
  return (
    <div className="duplicate-finder-container">
      <h2 className="widget-title">Detector de Flashcards Duplicados</h2>
      
      <div className="controls">
        <button 
          className="primary-button"
          onClick={fetchAllCards}
          disabled={isLoading}
        >
          {isLoading ? 'Buscando...' : 'Buscar Duplicatas'}
        </button>
        
        <input
          type="text"
          placeholder="Filtrar duplicatas..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="filter-input"
        />
      </div>
      
      {isLoading ? (
        <div className="loading">Analisando flashcards, por favor aguarde...</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">{allCards.length}</span>
              <span className="stat-label">Cartões</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{totalCount}</span>
              <span className="stat-label">Duplicatas</span>
            </div>
          </div>
          
          {totalCount > 0 ? (
            <div className="results">
              {exactCount > 0 && (
                <div className="result-section">
                  <h3>Correspondências Exatas ({exactCount})</h3>
                  {filterDuplicates(duplicates.exactMatches).map((pair, idx) => (
                    <div key={`exact-${idx}`} className="duplicate-pair">
                      <div className="similarity-badge exact">
                        Correspondência 100%
                      </div>
                      <div className="pair-cards">
                        {renderCard(pair.card1)}
                        {renderCard(pair.card2)}
                      </div>
                      <div className="pair-actions">
                        <button 
                          className="action-button merge"
                          onClick={() => mergeCards(pair)}
                        >
                          Mesclar
                        </button>
                        <button 
                          className="action-button ignore"
                          onClick={() => ignorePair(pair, 'exact')}
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {frontCount > 0 && (
                <div className="result-section">
                  <h3>Correspondências de Front ({frontCount})</h3>
                  {filterDuplicates(duplicates.frontMatches).map((pair, idx) => (
                    <div key={`front-${idx}`} className="duplicate-pair">
                      <div className="similarity-badge front">
                        Frente similar: {Math.round(pair.similarity * 100)}%
                      </div>
                      <div className="pair-cards">
                        {renderCard(pair.card1)}
                        {renderCard(pair.card2)}
                      </div>
                      <div className="pair-actions">
                        <button 
                          className="action-button merge"
                          onClick={() => mergeCards(pair)}
                        >
                          Mesclar
                        </button>
                        <button 
                          className="action-button ignore"
                          onClick={() => ignorePair(pair, 'front')}
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {similarCount > 0 && (
                <div className="result-section">
                  <h3>Cartões Similares ({similarCount})</h3>
                  {filterDuplicates(duplicates.similarCards).map((pair, idx) => (
                    <div key={`similar-${idx}`} className="duplicate-pair">
                      <div className="similarity-badge similar">
                        Similaridade: {Math.round(pair.similarity * 100)}%
                      </div>
                      <div className="pair-cards">
                        {renderCard(pair.card1)}
                        {renderCard(pair.card2)}
                      </div>
                      <div className="pair-actions">
                        <button 
                          className="action-button merge"
                          onClick={() => mergeCards(pair)}
                        >
                          Mesclar
                        </button>
                        <button 
                          className="action-button ignore"
                          onClick={() => ignorePair(pair, 'similar')}
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            allCards.length > 0 && (
              <div className="no-duplicates">
                Nenhuma duplicata encontrada entre {allCards.length} cartões.
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

// Registrar o widget
renderWidget(DuplicateFinderWidget);