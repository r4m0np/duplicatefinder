# Vamos demonstrar diferentes algoritmos de detecção de similaridade de texto
# que serão usados no plugin RemNote

import difflib
import re
from typing import List, Tuple, Dict

# Simulando algumas estruturas de flashcards para teste
sample_flashcards = [
    {"id": "1", "front": "O que é a fotossíntese?", "back": "Processo pelo qual as plantas convertem luz solar em energia"},
    {"id": "2", "front": "O que é fotossintese?", "back": "Processo onde plantas convertem luz em energia"},
    {"id": "3", "front": "Define fotossíntese", "back": "Conversão de luz solar em energia pelas plantas"},
    {"id": "4", "front": "Qual é a capital do Brasil?", "back": "Brasília"},
    {"id": "5", "front": "Capital do Brasil", "back": "Brasília"},
    {"id": "6", "front": "Qual a capital brasileira?", "back": "A capital do Brasil é Brasília"},
]

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calcula distância de Levenshtein entre duas strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def normalize_text(text: str) -> str:
    """Normaliza texto removendo acentos, pontuação e convertendo para minúsculas"""
    # Remove acentos (simplificado)
    replacements = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
        'é': 'e', 'ê': 'e',
        'í': 'i', 'î': 'i',
        'ó': 'o', 'ô': 'o', 'õ': 'o',
        'ú': 'u', 'û': 'u',
        'ç': 'c'
    }
    
    text = text.lower()
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    # Remove pontuação e múltiplos espaços
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def calculate_similarity(text1: str, text2: str) -> float:
    """Calcula similaridade usando diferentes métricas combinadas"""
    # Normaliza os textos
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)
    
    # Similaridade usando difflib
    ratio = difflib.SequenceMatcher(None, norm1, norm2).ratio()
    
    # Distância de Levenshtein normalizada
    max_len = max(len(norm1), len(norm2))
    if max_len == 0:
        levenshtein_sim = 1.0
    else:
        levenshtein_sim = 1 - (levenshtein_distance(norm1, norm2) / max_len)
    
    # Similaridade de palavras (Jaccard)
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    if len(words1) == 0 and len(words2) == 0:
        jaccard_sim = 1.0
    else:
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        jaccard_sim = intersection / union if union > 0 else 0
    
    # Combina as métricas (pesos podem ser ajustados)
    combined_score = (ratio * 0.4 + levenshtein_sim * 0.3 + jaccard_sim * 0.3)
    return combined_score

def find_duplicates(flashcards: List[Dict], similarity_threshold: float = 0.7) -> Dict:
    """Encontra flashcards duplicados ou similares"""
    duplicates = {
        'exact_matches': [],
        'front_matches': [],
        'similar_cards': []
    }
    
    for i in range(len(flashcards)):
        for j in range(i + 1, len(flashcards)):
            card1 = flashcards[i]
            card2 = flashcards[j]
            
            # Verifica correspondência exata
            if (normalize_text(card1['front']) == normalize_text(card2['front']) and 
                normalize_text(card1['back']) == normalize_text(card2['back'])):
                duplicates['exact_matches'].append((card1, card2))
                continue
            
            # Verifica correspondência apenas do front
            front_similarity = calculate_similarity(card1['front'], card2['front'])
            if front_similarity >= 0.9:  # Threshold alto para fronts
                duplicates['front_matches'].append((card1, card2, front_similarity))
                continue
            
            # Verifica similaridade geral
            if front_similarity >= similarity_threshold:
                back_similarity = calculate_similarity(card1['back'], card2['back'])
                avg_similarity = (front_similarity + back_similarity) / 2
                
                if avg_similarity >= similarity_threshold:
                    duplicates['similar_cards'].append((card1, card2, avg_similarity))
    
    return duplicates

# Executa a análise de duplicatas
print("=== Análise de Duplicatas em Flashcards ===\n")

print("Flashcards de exemplo:")
for i, card in enumerate(sample_flashcards, 1):
    print(f"{i}. Front: '{card['front']}' | Back: '{card['back']}'")

print("\n" + "="*50)

duplicates = find_duplicates(sample_flashcards, similarity_threshold=0.7)

print(f"\n📊 RESULTADOS DA ANÁLISE:")
print(f"Total de flashcards analisados: {len(sample_flashcards)}")

print(f"\n🔄 CORRESPONDÊNCIAS EXATAS: {len(duplicates['exact_matches'])}")
for pair in duplicates['exact_matches']:
    card1, card2 = pair
    print(f"  • Card {card1['id']} ↔ Card {card2['id']}")

print(f"\n⚡ CORRESPONDÊNCIAS DE FRENTE: {len(duplicates['front_matches'])}")
for item in duplicates['front_matches']:
    card1, card2, similarity = item
    print(f"  • Card {card1['id']} ↔ Card {card2['id']} (similaridade: {similarity:.2%})")
    print(f"    '{card1['front']}' vs '{card2['front']}'")

print(f"\n🔍 CARTÕES SIMILARES: {len(duplicates['similar_cards'])}")
for item in duplicates['similar_cards']:
    card1, card2, similarity = item
    print(f"  • Card {card1['id']} ↔ Card {card2['id']} (similaridade: {similarity:.2%})")
    print(f"    Front: '{card1['front']}' vs '{card2['front']}'")

print(f"\n💡 Total de possíveis duplicatas encontradas: {len(duplicates['exact_matches']) + len(duplicates['front_matches']) + len(duplicates['similar_cards'])}")