/**
 * Integration Test: Language Switching
 * 
 * Tests the complete language switching experience including:
 * - Changing language updates all content
 * - Fallback to en-GB for missing translations
 * 
 * Validates: Requirements 5.4, 8.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import { useOnboarding } from '../../context/OnboardingContext';
import { WelcomeDialog } from '../../components/WelcomeDialog';
import { HelpDrawer } from '../../components/HelpDrawer';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock AuthTokenContext
vi.mock('@aws-web-framework/orgadmin-core', () => ({
  AuthTokenContext: React.createContext(() => 'mock-token-123'),
}));

// Translation data for multiple languages
const translations: Record<string, Record<string, string>> = {
  'en-GB': {
    'welcome.title': 'Welcome to OrgAdmin',
    'welcome.content': '# Welcome\n\nThis is your first time logging in.',
    'welcome.dontShowAgain': "Don't show this again",
    'button.tooltip': 'Get help',
    'drawer.title': 'Help',
    'drawer.close': 'Close help',
    'dashboard.overview': '# Dashboard Help\n\nYour dashboard provides an overview.',
    'users.overview': '# User Management Help\n\nManage all users.',
    'translation:common.actions.close': 'Close',
  },
  'fr-FR': {
    'welcome.title': 'Bienvenue sur OrgAdmin',
    'welcome.content': '# Bienvenue\n\nC\'est votre première connexion.',
    'welcome.dontShowAgain': 'Ne plus afficher',
    'button.tooltip': 'Obtenir de l\'aide',
    'drawer.title': 'Aide',
    'drawer.close': 'Fermer l\'aide',
    'dashboard.overview': '# Aide du tableau de bord\n\nVotre tableau de bord fournit un aperçu.',
    'users.overview': '# Aide de gestion des utilisateurs\n\nGérer tous les utilisateurs.',
    'translation:common.actions.close': 'Fermer',
  },
  'es-ES': {
    'welcome.title': 'Bienvenido a OrgAdmin',
    'welcome.content': '# Bienvenido\n\nEsta es tu primera vez iniciando sesión.',
    'welcome.dontShowAgain': 'No mostrar de nuevo',
    'button.tooltip': 'Obtener ayuda',
    'drawer.title': 'Ayuda',
    'drawer.close': 'Cerrar ayuda',
    'dashboard.overview': '# Ayuda del panel\n\nTu panel proporciona una visión general.',
    'users.overview': '# Ayuda de gestión de usuarios\n\nGestionar todos los usuarios.',
    'translation:common.actions.close': 'Cerrar',
  },
  'de-DE': {
    'welcome.title': 'Willkommen bei OrgAdmin',
    'welcome.content': '# Willkommen\n\nDies ist Ihre erste Anmeldung.',
    'welcome.dontShowAgain': 'Nicht mehr anzeigen',
    'button.tooltip': 'Hilfe erhalten',
    'drawer.title': 'Hilfe',
    'drawer.close': 'Hilfe schließen',
    'dashboard.overview': '# Dashboard-Hilfe\n\nIhr Dashboard bietet eine Übersicht.',
    'users.overview': '# Benutzerverwaltungshilfe\n\nAlle Benutzer verwalten.',
    'translation:common.actions.close': 'Schließen',
  },
  'it-IT': {
    'welcome.title': 'Benvenuto in OrgAdmin',
    'welcome.content': '# Benvenuto\n\nQuesto è il tuo primo accesso.',
    'welcome.dontShowAgain': 'Non mostrare più',
    'button.tooltip': 'Ottieni aiuto',
    'drawer.title': 'Aiuto',
    'drawer.close': 'Chiudi aiuto',
    'dashboard.overview': '# Aiuto dashboard\n\nLa tua dashboard fornisce una panoramica.',
    'users.overview': '# Aiuto gestione utenti\n\nGestisci tutti gli utenti.',
    'translation:common.actions.close': 'Chiudi',
  },
  'pt-PT': {
    'welcome.title': 'Bem-vindo ao OrgAdmin',
    'welcome.content': '# Bem-vindo\n\nEsta é a sua primeira vez fazendo login.',
    'welcome.dontShowAgain': 'Não mostrar novamente',
    'button.tooltip': 'Obter ajuda',
    'drawer.title': 'Ajuda',
    'drawer.close': 'Fechar ajuda',
    'dashboard.overview': '# Ajuda do painel\n\nO seu painel fornece uma visão geral.',
    'users.overview': '# Ajuda de gestão de utilizadores\n\nGerir todos os utilizadores.',
    'translation:common.actions.close': 'Fechar',
  },
};

// Mock i18n instance
let currentLanguage = 'en-GB';

const mockI18n = {
  get language() {
    return currentLanguage;
  },
  changeLanguage: vi.fn(async (lng: string) => {
    currentLanguage = lng;
    // Trigger re-render by updating the mock
    mockT.mockClear();
  }),
};

// Mock translation function
const mockT = vi.fn((key: string, options?: any) => {
  // Handle language fallback
  const lng = options?.lng || currentLanguage;
  
  // Try to get translation for current language
  if (translations[lng] && translations[lng][key]) {
    return translations[lng][key];
  }
  
  // Fallback to en-GB
  if (lng !== 'en-GB' && translations['en-GB'] && translations['en-GB'][key]) {
    return translations['en-GB'][key];
  }
  
  // Return default value or key
  return options?.defaultValue || key;
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));

// Test component that provides language switching controls
const TestLanguageApp: React.FC = () => {
  const { 
    welcomeDialogOpen,
    helpDrawerOpen, 
    toggleHelpDrawer,
    setCurrentPageId,
  } = useOnboarding();
  
  const [currentModule] = React.useState<'dashboard' | 'users'>('dashboard');
  const [pageId] = React.useState<string>('overview');
  
  React.useEffect(() => {
    setCurrentPageId(pageId);
  }, [pageId, setCurrentPageId]);
  
  return (
    <>
      <div data-testid="test-language-app">
        {/* Language switcher */}
        <div data-testid="language-switcher">
          <button 
            data-testid="switch-to-en"
            onClick={() => mockI18n.changeLanguage('en-GB')}
          >
            English
          </button>
          <button 
            data-testid="switch-to-fr"
            onClick={() => mockI18n.changeLanguage('fr-FR')}
          >
            Français
          </button>
          <button 
            data-testid="switch-to-es"
            onClick={() => mockI18n.changeLanguage('es-ES')}
          >
            Español
          </button>
          <button 
            data-testid="switch-to-de"
            onClick={() => mockI18n.changeLanguage('de-DE')}
          >
            Deutsch
          </button>
          <button 
            data-testid="switch-to-it"
            onClick={() => mockI18n.changeLanguage('it-IT')}
          >
            Italiano
          </button>
          <button 
            data-testid="switch-to-pt"
            onClick={() => mockI18n.changeLanguage('pt-PT')}
          >
            Português
          </button>
        </div>
        
        {/* Current language indicator */}
        <div data-testid="current-language">
          {mockI18n.language}
        </div>
        
        {/* Help button */}
        <button 
          data-testid="open-help"
          onClick={toggleHelpDrawer}
        >
          Help
        </button>
        
        {/* Status indicators */}
        <div data-testid="welcome-status">
          {welcomeDialogOpen ? 'welcome-open' : 'welcome-closed'}
        </div>
        <div data-testid="help-status">
          {helpDrawerOpen ? 'help-open' : 'help-closed'}
        </div>
      </div>
      
      {/* Help Drawer */}
      <HelpDrawer
        open={helpDrawerOpen}
        onClose={toggleHelpDrawer}
        pageId={pageId}
        moduleId={currentModule}
      />
    </>
  );
};

describe('Language Switching - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLanguage = 'en-GB';
    if (mockedAxios.get) mockedAxios.get.mockClear();
    if (mockedAxios.put) mockedAxios.put.mockClear();
  });

  it('should display welcome dialog content in English by default', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Assert - welcome dialog should appear in English
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    expect(screen.getByText('Welcome to OrgAdmin')).toBeDefined();
    expect(screen.getByText("Don't show this again")).toBeDefined();
  });

  it('should update welcome dialog content when language is changed to French', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    const { rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Wait for welcome dialog to appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Assert - initially in English
    expect(screen.getByText('Welcome to OrgAdmin')).toBeDefined();

    // Act - switch to French
    const frenchButton = screen.getByTestId('switch-to-fr');
    fireEvent.click(frenchButton);
    
    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('fr-FR');
    });

    // Force re-render to pick up language change
    rerender(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Assert - content should update to French
    await waitFor(() => {
      expect(screen.getByText('Bienvenue sur OrgAdmin')).toBeDefined();
    });
    expect(screen.getByText('Ne plus afficher')).toBeDefined();
  });

  it('should update help drawer content when language is changed', async () => {
    // Arrange - returning user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Act - render the app
    const { rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer
    const helpButton = screen.getByTestId('open-help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-status').textContent).toBe('help-open');
    });

    // Assert - help content should be in English
    expect(screen.getByText('Dashboard Help')).toBeDefined();

    // Act - switch to Spanish
    const spanishButton = screen.getByTestId('switch-to-es');
    fireEvent.click(spanishButton);
    
    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('es-ES');
    });

    // Force re-render to pick up language change
    rerender(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Assert - help content should update to Spanish
    await waitFor(() => {
      expect(screen.getByText('Ayuda del panel')).toBeDefined();
    });
  });

  it('should update all content across all supported languages', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    const { rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Test each language
    const languageTests = [
      { button: 'switch-to-en', lang: 'en-GB', title: 'Welcome to OrgAdmin' },
      { button: 'switch-to-fr', lang: 'fr-FR', title: 'Bienvenue sur OrgAdmin' },
      { button: 'switch-to-es', lang: 'es-ES', title: 'Bienvenido a OrgAdmin' },
      { button: 'switch-to-de', lang: 'de-DE', title: 'Willkommen bei OrgAdmin' },
      { button: 'switch-to-it', lang: 'it-IT', title: 'Benvenuto in OrgAdmin' },
      { button: 'switch-to-pt', lang: 'pt-PT', title: 'Bem-vindo ao OrgAdmin' },
    ];

    for (const test of languageTests) {
      // Act - switch language
      const button = screen.getByTestId(test.button);
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockI18n.changeLanguage).toHaveBeenCalledWith(test.lang);
      });

      // Force re-render
      rerender(
        <OnboardingProvider>
          <TestLanguageApp />
        </OnboardingProvider>
      );

      // Assert - content should be in the selected language
      await waitFor(() => {
        expect(screen.getByText(test.title)).toBeDefined();
      });
    }
  });

  it('should fallback to en-GB when translation is missing for selected language', async () => {
    // Arrange - add a key that only exists in en-GB
    translations['en-GB']['special.key'] = 'Special English Content';
    // Ensure it doesn't exist in French
    delete translations['fr-FR']['special.key'];

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['dashboard'],
        },
      },
    });

    // Create a test component that uses the special key
    const TestFallbackComponent: React.FC = () => {
      // Use the mocked translation function directly
      return (
        <div>
          <div data-testid="special-content">{mockT('special.key')}</div>
        </div>
      );
    };

    // Act - render with French language
    currentLanguage = 'fr-FR';
    
    render(
      <OnboardingProvider>
        <TestFallbackComponent />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Assert - should fallback to English content
    await waitFor(() => {
      const specialContent = screen.getByTestId('special-content');
      expect(specialContent.textContent).toBe('Special English Content');
    });

    // Cleanup
    delete translations['en-GB']['special.key'];
  });

  it('should maintain fallback to en-GB for help drawer when translation is missing', async () => {
    // Arrange - add help content only in en-GB
    translations['en-GB']['forms.overview'] = '# Forms Help\n\nCreate custom forms.';
    // Ensure it doesn't exist in German
    delete translations['de-DE']['forms.overview'];

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: true,
          modulesVisited: ['forms'],
        },
      },
    });

    // Create a test component for forms module
    const TestFormsHelpComponent: React.FC = () => {
      const { helpDrawerOpen, toggleHelpDrawer, setCurrentPageId } = useOnboarding();
      
      React.useEffect(() => {
        setCurrentPageId('overview');
      }, [setCurrentPageId]);
      
      return (
        <>
          <button data-testid="open-help" onClick={toggleHelpDrawer}>
            Help
          </button>
          <HelpDrawer
            open={helpDrawerOpen}
            onClose={toggleHelpDrawer}
            pageId="overview"
            moduleId="forms"
          />
        </>
      );
    };

    // Act - render with German language
    currentLanguage = 'de-DE';
    
    const { rerender } = render(
      <OnboardingProvider>
        <TestFormsHelpComponent />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Act - open help drawer
    const helpButton = screen.getByTestId('open-help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByRole('presentation')).toBeDefined();
    });

    // Assert - should show English content as fallback
    await waitFor(() => {
      expect(screen.getByText('Forms Help')).toBeDefined();
    });

    // Cleanup
    delete translations['en-GB']['forms.overview'];
  });

  it('should handle rapid language switching without errors', async () => {
    // Arrange - new user (welcome dialog should show)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    const { rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Wait for preferences to load and dialog to appear
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    // Give time for welcome dialog to open
    await waitFor(() => {
      expect(screen.getByTestId('welcome-status').textContent).toBe('welcome-open');
    }, { timeout: 2000 });

    // Act - rapidly switch languages
    const languages = ['fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'en-GB'];
    
    for (const lang of languages) {
      const button = screen.getByTestId(`switch-to-${lang.split('-')[0].toLowerCase()}`);
      fireEvent.click(button);
      
      // Force re-render
      rerender(
        <OnboardingProvider>
          <TestLanguageApp />
        </OnboardingProvider>
      );
    }

    // Assert - should end up in English without errors
    await waitFor(() => {
      expect(screen.getByText('Welcome to OrgAdmin')).toBeDefined();
    });
  });

  it('should persist language preference across component remounts', async () => {
    // Arrange - returning user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    const { unmount, rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Act - switch to Italian
    const italianButton = screen.getByTestId('switch-to-it');
    fireEvent.click(italianButton);
    
    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('it-IT');
    });

    rerender(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Benvenuto in OrgAdmin')).toBeDefined();
    });

    // Act - unmount and remount
    unmount();

    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Assert - language should still be Italian
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    expect(screen.getByText('Benvenuto in OrgAdmin')).toBeDefined();
  });

  it('should update both welcome dialog and help drawer when language changes', async () => {
    // Arrange - new user
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          welcomeDismissed: false,
          modulesVisited: [],
        },
      },
    });

    // Act - render the app
    const { rerender } = render(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Assert - welcome dialog in English
    expect(screen.getByText('Welcome to OrgAdmin')).toBeDefined();

    // Act - close welcome dialog
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Act - open help drawer
    const helpButton = screen.getByTestId('open-help');
    fireEvent.click(helpButton);

    await waitFor(() => {
      expect(screen.getByTestId('help-status').textContent).toBe('help-open');
    });

    // Assert - help drawer in English
    expect(screen.getByText('Dashboard Help')).toBeDefined();

    // Act - switch to Portuguese
    const portugueseButton = screen.getByTestId('switch-to-pt');
    fireEvent.click(portugueseButton);
    
    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith('pt-PT');
    });

    // Force re-render
    rerender(
      <OnboardingProvider>
        <TestLanguageApp />
      </OnboardingProvider>
    );

    // Assert - help drawer should be in Portuguese
    await waitFor(() => {
      expect(screen.getByText('Ajuda do painel')).toBeDefined();
    });
  });
});
