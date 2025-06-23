import { 
  AppEvents, 
  declareIndexPlugin, 
  ReactRNPlugin, 
  WidgetLocation 
} from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import { DuplicateFinderWidget } from './duplicate-finder-widget';

// Função principal de ativação do plugin
async function onActivate(plugin: ReactRNPlugin) {
  // Registrar o widget principal do plugin
  await plugin.app.registerWidget(
    'duplicate-finder',
    WidgetLocation.RightSidebar,
    {
      dimensions: { height: 'auto', width: '100%' },
    }
  );

  // Registrar configurações do plugin
  await plugin.settings.registerStringSetting({
    id: 'blacklist-tags',
    title: 'Tags da lista negra',
    description: 'Lista de tags separadas por vírgula para excluir da busca por duplicatas',
    defaultValue: '',
  });

  await plugin.settings.registerNumberSetting({
    id: 'similarity-threshold',
    title: 'Limiar de similaridade',
    description: 'Limiar de similaridade para detecção (0.0 a 1.0)',
    defaultValue: 0.75,
    min: 0.5,
    max: 1.0,
    step: 0.05,
  });

  await plugin.settings.registerBooleanSetting({
    id: 'check-front-only',
    title: 'Verificar apenas o front dos flashcards',
    description: 'Se ativado, verifica apenas o texto do front dos flashcards',
    defaultValue: false,
  });

  await plugin.settings.registerBooleanSetting({
    id: 'enable-fuzzy-search',
    title: 'Habilitar busca fuzzy',
    description: 'Se ativado, usa algoritmos de busca fuzzy para encontrar cartões similares',
    defaultValue: true,
  });

  // Registrar um PowerUp para marcação de cartões verificados
  await plugin.app.registerPowerup({
    name: 'Cartão Verificado',
    code: 'verified-card',
    description: 'Marca cartões que foram verificados para não duplicatas',
    options: {
      properties: [
        {
          name: 'Verificado Em',
          code: 'verified-date',
          propertyType: 'DATE',
          description: 'Data da verificação do cartão',
        },
      ],
    },
  });

  // Registrar comandos
  await plugin.app.registerCommand({
    id: 'find-duplicates',
    name: 'Encontrar Duplicatas de Flashcards',
    description: 'Encontra todos os flashcards duplicados ou similares',
    action: async () => {
      // Este comando vai abrir o widget na barra lateral
      plugin.window.openRightSidebar();
    },
  });
}

// Função de desativação do plugin
async function onDeactivate(_: ReactRNPlugin) {
  // Limpeza de recursos, se necessário
}

// Declaração do plugin
declareIndexPlugin(onActivate, onDeactivate);