import {
  Rem,
  RichText,
  usePlugin,
  useRunAsync,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { jaroWinkler } from '@skyra/jaro-winkler';
import unidecode from 'unidecode';

// INTERFACES E TIPOS
interface Pair {
  rem1: Rem;
  rem2: Rem;
  similarity?: number;
}

interface Duplicates {
  exactMatches: Pair[];
  frontMatches: Pair[];
  similarCards: Pair[];
}

const VERIFIED_REMS_STORAGE_KEY = 'verifiedRemIds';

// --- FUNÇÕES UTILITÁRIAS ---
// Para manter em um só arquivo, foram colocadas aqui. Idealmente, ficariam em `src/utils.ts`.

/**
 * Normaliza o texto removendo acentos, pontuação e convertendo para minúsculas.
 */
function normalizeText(text: RichText): string {
  const plainText = text?.toString() || '';
  return unidecode(plainText)
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ')   // Normaliza espaços
    .trim();
}

/**
 * Calcula a similaridade combinada entre dois textos usando Jaro-Winkler.
 */
function calculateSimilarity(text1: RichText, text2: RichText): number {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  if (!normalized1 && !normalized2) return 1;
  if (!normalized1 || !normalized2) return 0;
  return jaroWinkler(normalized1, normalized2);
}

/**
 * Gera uma chave única para um flashcard para detecção de duplicatas exatas.
 */
function getExactMatchKey(rem: Rem, checkOnlyFront: boolean): string {
  const front = normalizeText(rem.text);
  if (checkOnlyFront) {
    return front;
  }
  const back = normalizeText(rem.backText);
  return `${front}::${back}`;
}

/**
 * Gera uma chave para a frente do flashcard.
 */
function getFrontMatchKey(rem: Rem): string {
    return normalizeText(rem.text);
}


// --- COMPONENTE PRINCIPAL ---

export const DuplicateFinderWidget = () => {
  const plugin = usePlugin();

  // Estados do Componente
  const [duplicates, setDuplicates] = useState<Duplicates>({
    exactMatches: [],
    frontMatches: [],
    similarCards: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  
  // Estado para persistência de Rems verificados
  const [verifiedRemIds, setVerifiedRemIds] = useState<Set<string>>(new Set());
  
  // Estados para o Modal de Mesclagem
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mergingPair, setMergingPair] = useState<Pair | null>(null);
  const [finalFrontText, setFinalFrontText] = useState('');
  const [finalBackText, setFinalBackText] = useState('');

  // Carregar Rems verificados do armazenamento persistente na inicialização
  useEffect(() => {
    plugin.storage.get<string[]>(VERIFIED_REMS_STORAGE_KEY).then((ids) => {
      if (ids) {
        setVerifiedRemIds(new Set(ids));
      }
    });
  }, [plugin]);

  // Hook para buscar as configurações do plugin
  const settings = useRunAsync(
    () => plugin.settings.getSetting('settingsGroup'),[]
  );

  // Função para salvar Rems verificados no estado e no armazenamento
  const updateVerifiedRems = useCallback((newSet: Set<string>) => {
      setVerifiedRemIds(newSet);
      plugin.storage.set(VERIFIED_REMS_STORAGE_KEY, Array.from(newSet));
  }, [plugin]);
  
  const handleMarkAsVerified = (remId: string) => {
    const newSet = new Set(verifiedRemIds);
    newSet.add(remId);
    updateVerifiedRems(newSet);
    // Remove os pares que contêm o Rem verificado da visão atual
    setDuplicates(prev => ({
        exactMatches: prev.exactMatches.filter(p => p.rem1._id !== remId && p.rem2._id !== remId),
        frontMatches: prev.frontMatches.filter(p => p.rem1._id !== remId && p.rem2._id !== remId),
        similarCards: prev.similarCards.filter(p => p.rem1._id !== remId && p.rem2._id !== remId),
    }));
  };

  // Função de busca principal, agora otimizada
  const handleSearch = useCallback(async () => {
    if (!settings) {
        plugin.app.toast("Configurações não carregadas. Tente novamente.");
        return;
    }
    setIsSearching(true);
    setError(null);
    setDuplicates({ exactMatches: [], frontMatches: [], similarCards: [] });
    setProgress({ current: 0, total: 0 });

    try {
      const allFlashcards = await plugin.rem.getAllFlashcards();
      const blacklistTagsSet = new Set(settings.blacklistTags as string[]);
      
      const filteredFlashcards = allFlashcards.filter(rem => 
        !verifiedRemIds.has(rem._id) && 
        (!rem.tags?.some(tagId => blacklistTagsSet.has(tagId)))
      );
      
      setProgress({ current: 0, total: filteredFlashcards.length });

      // --- Busca O(n) para correspondências exatas e de frente ---
      const exactMap = new Map<string, Rem[]>();
      const frontMap = new Map<string, Rem[]>();

      for (const rem of filteredFlashcards) {
        const exactKey = getExactMatchKey(rem, settings.checkOnlyFront as boolean);
        if (!exactMap.has(exactKey)) exactMap.set(exactKey, []);
        exactMap.get(exactKey)!.push(rem);
        
        const frontKey = getFrontMatchKey(rem);
        if (!frontMap.has(frontKey)) frontMap.set(frontKey, []);
        frontMap.get(frontKey)!.push(rem);
      }

      const exactMatches: Pair[] = Array.from(exactMap.values())
        .filter(group => group.length > 1)
        .flatMap(group => { // Gera todos os pares possíveis no grupo
            const pairs: Pair[] = [];
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    pairs.push({ rem1: group[i], rem2: group[j] });
                }
            }
            return pairs;
        });

      const frontMatches: Pair[] = Array.from(frontMap.values())
        .filter(group => group.length > 1)
        .flatMap(group => {
            const pairs: Pair[] = [];
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    pairs.push({ rem1: group[i], rem2: group[j] });
                }
            }
            return pairs;
        });

      setDuplicates(prev => ({ ...prev, exactMatches, frontMatches }));

      // --- Busca por Similaridade (O(n^2), mas com UI não bloqueante) ---
      const similarCards: Pair[] = [];
      const similarityThreshold = settings.similarityThreshold as number;
      const checkOnlyFront = settings.checkOnlyFront as boolean;
      
      for (let i = 0; i < filteredFlashcards.length; i++) {
        setProgress({ current: i + 1, total: filteredFlashcards.length });
        if (i % 50 === 0) { // Permite a UI atualizar a cada 50 iterações
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        for (let j = i + 1; j < filteredFlashcards.length; j++) {
            const rem1 = filteredFlashcards[i];
            const rem2 = filteredFlashcards[j];
            
            const frontSimilarity = calculateSimilarity(rem1.text, rem2.text);
            
            if (checkOnlyFront) {
                if(frontSimilarity >= similarityThreshold) {
                    similarCards.push({ rem1, rem2, similarity: frontSimilarity });
                }
            } else {
                const backSimilarity = calculateSimilarity(rem1.backText, rem2.backText);
                const combinedSimilarity = (frontSimilarity + backSimilarity) / 2;
                if (combinedSimilarity >= similarityThreshold) {
                    similarCards.push({ rem1, rem2, similarity: combinedSimilarity });
                }
            }
        }
      }

      setDuplicates(prev => ({...prev, similarCards: similarCards.sort((a,b) => b.similarity! - a.similarity!) }));

    } catch (e: any) {
      setError(`Ocorreu um erro: ${e.message}`);
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, [settings, plugin, verifiedRemIds]);


  // --- LÓGICA DO MODAL DE MESCLAGEM ---
  
  const openMergeModal = (pair: Pair) => {
    setMergingPair(pair);
    setFinalFrontText(pair.rem1.text?.toString() || '');
    setFinalBackText(pair.rem1.backText?.toString() || '');
    setIsModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergingPair) return;

    try {
      const remToKeep = mergingPair.rem1;
      const remToDelete = mergingPair.rem2;

      await plugin.rem.setText(remToKeep._id, [finalFrontText]);
      await plugin.rem.setBackText(remToKeep._id, [finalBackText]);

      const tagsToDelete = await remToDelete.getTags();
      for (const tag of tagsToDelete) {
        await remToKeep.addTag(tag._id);
      }

      await plugin.rem.delete(remToDelete._id);
      
      plugin.app.toast(`Cartão mesclado com sucesso. O cartão "${remToDelete.text?.toString().substring(0, 20)}..." foi apagado.`);

      setIsModalOpen(false);
      setMergingPair(null);

      setDuplicates(prev => ({
          exactMatches: prev.exactMatches.filter(p => p.rem2._id !== remToDelete._id && p.rem1._id !== remToDelete._id),
          frontMatches: prev.frontMatches.filter(p => p.rem2._id !== remToDelete._id && p.rem1._id !== remToDelete._id),
          similarCards: prev.similarCards.filter(p => p.rem2._id !== remToDelete._id && p.rem1._id !== remToDelete._id),
      }));

    } catch (err) {
      console.error("Erro ao mesclar Rems:", err);
      plugin.app.toast("Ocorreu um erro ao tentar mesclar os cartões.");
    }
  };


  // --- RENDERIZAÇÃO ---

  const filteredDuplicates = useMemo(() => {
    if (!filter) return duplicates;
    const lowerCaseFilter = filter.toLowerCase();
    
    const filterPairs = (pairs: Pair[]) => pairs.filter(p => 
        p.rem1.text?.toString().toLowerCase().includes(lowerCaseFilter) ||
        p.rem2.text?.toString().toLowerCase().includes(lowerCaseFilter)
    );

    return {
        exactMatches: filterPairs(duplicates.exactMatches),
        frontMatches: filterPairs(duplicates.frontMatches),
        similarCards: filterPairs(duplicates.similarCards),
    }
  }, [duplicates, filter]);

  const renderPair = (pair: Pair, type: string) => (
    <div key={pair.rem1._id + pair.rem2._id} className="duplicate-pair">
      <div className="card-item">
        <p className="rem-text" onClick={() => plugin.app.navigate(pair.rem1._id)}>{pair.rem1.text}</p>
        <div className="rem-actions">
          <button onClick={() => handleMarkAsVerified(pair.rem1._id)}>Marcar Verificado</button>
        </div>
      </div>
      <div className="card-item">
        <p className="rem-text" onClick={() => plugin.app.navigate(pair.rem2._id)}>{pair.rem2.text}</p>
        <div className="rem-actions">
          <button onClick={() => handleMarkAsVerified(pair.rem2._id)}>Marcar Verificado</button>
        </div>
      </div>
      <div className="pair-actions">
        {pair.similarity && <span className="similarity-badge">{(pair.similarity * 100).toFixed(0)}%</span>}
        <button onClick={() => openMergeModal(pair)}>Mesclar</button>
      </div>
    </div>
  );

  return (
    <div className="p-2 space-y-4">
      <div className="flex space-x-2">
        <button onClick={handleSearch} disabled={isSearching} className="btn-primary w-full">
            {isSearching ? 'Buscando...' : 'Encontrar Duplicatas'}
        </button>
      </div>
      
      {isSearching && progress.total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
            <p className="text-xs text-center">{progress.current} / {progress.total}</p>
        </div>
      )}

      {error && <div className="text-red-500">{error}</div>}

      <input 
        type="text" 
        placeholder="Filtrar resultados..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full p-1 border rounded"
      />
      
      <div className="results-container space-y-4">
        {filteredDuplicates.exactMatches.length > 0 && (
            <div>
                <h3 className="font-bold">Correspondências Exatas ({filteredDuplicates.exactMatches.length})</h3>
                {filteredDuplicates.exactMatches.map(p => renderPair(p, 'exact'))}
            </div>
        )}
        {filteredDuplicates.frontMatches.length > 0 && (
            <div>
                <h3 className="font-bold">Correspondências de Frente ({filteredDuplicates.frontMatches.length})</h3>
                {filteredDuplicates.frontMatches.map(p => renderPair(p, 'front'))}
            </div>
        )}
        {filteredDuplicates.similarCards.length > 0 && (
            <div>
                <h3 className="font-bold">Cartões Similares ({filteredDuplicates.similarCards.length})</h3>
                {filteredDuplicates.similarCards.map(p => renderPair(p, 'similar'))}
            </div>
        )}
      </div>

      {isModalOpen && mergingPair && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-lg font-bold mb-4">Pré-visualização da Mesclagem</h2>
            
            <div className="merge-preview-grid">
              {/* Coluna 1: Cartão 1 */}
              <div>
                <h3 className="font-semibold">Cartão 1 (Será Mantido)</h3>
                <div className="card-preview">
                  <strong>Frente:</strong>
                  <p>{mergingPair.rem1.text?.toString()}</p>
                  <strong>Verso:</strong>
                  <p>{mergingPair.rem1.backText?.toString()}</p>
                </div>
              </div>

              {/* Coluna 2: Cartão 2 */}
              <div>
                <h3 className="font-semibold">Cartão 2 (Será Apagado)</h3>
                <div className="card-preview">
                  <strong>Frente:</strong>
                  <p>{mergingPair.rem2.text?.toString()}</p>
                  <strong>Verso:</strong>
                  <p>{mergingPair.rem2.backText?.toString()}</p>
                </div>
              </div>

              {/* Coluna 3: Resultado Final (Editável) */}
              <div>
                <h3 className="font-semibold">Resultado da Mesclagem</h3>
                <div className="card-preview-editable">
                  <label><strong>Frente:</strong></label>
                  <textarea
                    value={finalFrontText}
                    onChange={(e) => setFinalFrontText(e.target.value)}
                    rows={5}
                  />
                  <div className="button-group">
                    <button onClick={() => setFinalFrontText(mergingPair.rem1.text?.toString() || '')}>Usar Frente 1</button>
                    <button onClick={() => setFinalFrontText(mergingPair.rem2.text?.toString() || '')}>Usar Frente 2</button>
                  </div>
                  
                  <label className="mt-2"><strong>Verso:</strong></label>
                  <textarea
                    value={finalBackText}
                    onChange={(e) => setFinalBackText(e.target.value)}
                    rows={5}
                  />
                  <div className="button-group">
                    <button onClick={() => setFinalBackText(mergingPair.rem1.backText?.toString() || '')}>Usar Verso 1</button>
                    <button onClick={() => setFinalBackText(mergingPair.rem2.backText?.toString() || '')}>Usar Verso 2</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleConfirmMerge} className="btn-primary">
                Confirmar e Mesclar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};