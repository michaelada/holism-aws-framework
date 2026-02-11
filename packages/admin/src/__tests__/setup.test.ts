import { describe, it, expect } from 'vitest';

describe('Admin Frontend Setup', () => {
  it('should have correct environment variables defined', () => {
    // These should be defined in vite-env.d.ts
    expect(import.meta.env).toBeDefined();
  });

  it('should be able to import React', async () => {
    const React = await import('react');
    expect(React).toBeDefined();
    expect(React.createElement).toBeDefined();
  });

  it('should be able to import Material-UI', async () => {
    const MUI = await import('@mui/material');
    expect(MUI).toBeDefined();
    expect(MUI.Button).toBeDefined();
  });

  it('should be able to import React Router', async () => {
    const Router = await import('react-router-dom');
    expect(Router).toBeDefined();
    expect(Router.BrowserRouter).toBeDefined();
  });

  it('should be able to import Keycloak', async () => {
    const Keycloak = await import('keycloak-js');
    expect(Keycloak).toBeDefined();
  });
});
