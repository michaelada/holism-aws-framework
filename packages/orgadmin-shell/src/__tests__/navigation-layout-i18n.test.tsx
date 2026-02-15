import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import i18n, { initializeI18n } from '../i18n/config';

// Simple test to verify navigation and dashboard translations exist
describe('Navigation and Layout i18n', () => {
  beforeAll(async () => {
    // Initialize i18n before all tests with all translations preloaded
    await initializeI18n('en-GB', true);
  });

  beforeEach(async () => {
    // Reset i18n to English before each test
    await i18n.changeLanguage('en-GB');
  });

  describe('Navigation translations', () => {
    it('should have navigation translations in English', () => {
      expect(i18n.t('navigation.organisation')).toBe('Organisation');
      expect(i18n.t('navigation.loading')).toBe('Loading...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Back to Main Page');
      expect(i18n.t('navigation.logout')).toBe('Logout');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should have navigation translations in French', async () => {
      await i18n.changeLanguage('fr-FR');
      
      expect(i18n.t('navigation.organisation')).toBe('Organisation');
      expect(i18n.t('navigation.loading')).toBe('Chargement...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Retour à la page principale');
      expect(i18n.t('navigation.logout')).toBe('Déconnexion');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should have navigation translations in Spanish', async () => {
      await i18n.changeLanguage('es-ES');
      
      expect(i18n.t('navigation.organisation')).toBe('Organización');
      expect(i18n.t('navigation.loading')).toBe('Cargando...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Volver a la página principal');
      expect(i18n.t('navigation.logout')).toBe('Cerrar sesión');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should have navigation translations in Italian', async () => {
      await i18n.changeLanguage('it-IT');
      
      expect(i18n.t('navigation.organisation')).toBe('Organizzazione');
      expect(i18n.t('navigation.loading')).toBe('Caricamento...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Torna alla pagina principale');
      expect(i18n.t('navigation.logout')).toBe('Disconnetti');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should have navigation translations in German', async () => {
      await i18n.changeLanguage('de-DE');
      
      expect(i18n.t('navigation.organisation')).toBe('Organisation');
      expect(i18n.t('navigation.loading')).toBe('Wird geladen...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Zurück zur Hauptseite');
      expect(i18n.t('navigation.logout')).toBe('Abmelden');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should have navigation translations in Portuguese', async () => {
      await i18n.changeLanguage('pt-PT');
      
      expect(i18n.t('navigation.organisation')).toBe('Organização');
      expect(i18n.t('navigation.loading')).toBe('A carregar...');
      expect(i18n.t('navigation.backToMainPage')).toBe('Voltar à página principal');
      expect(i18n.t('navigation.logout')).toBe('Terminar sessão');
      expect(i18n.t('navigation.appName')).toBe('ItsPlainSailing');
    });

    it('should update navigation translations when locale changes', async () => {
      expect(i18n.t('navigation.logout')).toBe('Logout');
      
      await i18n.changeLanguage('fr-FR');
      expect(i18n.t('navigation.logout')).toBe('Déconnexion');
      
      await i18n.changeLanguage('es-ES');
      expect(i18n.t('navigation.logout')).toBe('Cerrar sesión');
    });
  });

  describe('Dashboard translations', () => {
    it('should have dashboard translations in English', () => {
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Welcome to Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Select an area below to get started');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('No modules available');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Contact your administrator to enable capabilities for your organisation.');
    });

    it('should have dashboard translations in French', async () => {
      await i18n.changeLanguage('fr-FR');
      
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Bienvenue à Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Sélectionnez une zone ci-dessous pour commencer');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('Aucun module disponible');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Contactez votre administrateur pour activer les fonctionnalités de votre organisation.');
    });

    it('should have dashboard translations in Spanish', async () => {
      await i18n.changeLanguage('es-ES');
      
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Bienvenido a Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Seleccione un área a continuación para comenzar');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('No hay módulos disponibles');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Póngase en contacto con su administrador para habilitar las capacidades de su organización.');
    });

    it('should have dashboard translations in Italian', async () => {
      await i18n.changeLanguage('it-IT');
      
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Benvenuto a Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Seleziona un\'area qui sotto per iniziare');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('Nessun modulo disponibile');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Contatta il tuo amministratore per abilitare le funzionalità per la tua organizzazione.');
    });

    it('should have dashboard translations in German', async () => {
      await i18n.changeLanguage('de-DE');
      
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Willkommen bei Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Wählen Sie unten einen Bereich aus, um zu beginnen');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('Keine Module verfügbar');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Wenden Sie sich an Ihren Administrator, um Funktionen für Ihre Organisation zu aktivieren.');
    });

    it('should have dashboard translations in Portuguese', async () => {
      await i18n.changeLanguage('pt-PT');
      
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test Org' })).toBe('Bem-vindo a Test Org');
      expect(i18n.t('dashboard.selectArea')).toBe('Selecione uma área abaixo para começar');
      expect(i18n.t('dashboard.noModulesAvailable')).toBe('Nenhum módulo disponível');
      expect(i18n.t('dashboard.contactAdministrator')).toBe('Contacte o seu administrador para ativar as capacidades da sua organização.');
    });

    it('should update dashboard translations when locale changes', async () => {
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test' })).toBe('Welcome to Test');
      
      await i18n.changeLanguage('fr-FR');
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test' })).toBe('Bienvenue à Test');
      
      await i18n.changeLanguage('de-DE');
      expect(i18n.t('dashboard.welcomeTo', { organisationName: 'Test' })).toBe('Willkommen bei Test');
    });

    it('should support interpolation in dashboard translations', async () => {
      expect(i18n.t('dashboard.debugInfo', { capabilitiesCount: 5, modulesCount: 3 })).toBe('Debug: 5 capabilities enabled, 3 modules available');
      
      await i18n.changeLanguage('fr-FR');
      expect(i18n.t('dashboard.debugInfo', { capabilitiesCount: 5, modulesCount: 3 })).toBe('Débogage : 5 fonctionnalités activées, 3 modules disponibles');
    });
  });
});
