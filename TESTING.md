# 🧪 Testing Guide for Casa Web

## Overview

This project uses a comprehensive testing stack to ensure code quality and reliability:

- **Vitest**: Unit and component testing
- **Playwright**: End-to-end testing
- **Testing Library**: React component testing utilities
- **MCP Servers**: AI-assisted testing and debugging

---

## 📦 Test Scripts

```bash
# Unit/Component Tests
npm run test              # Run tests in watch mode
npm run test:ui           # Open Vitest UI
npm run test:coverage     # Generate coverage report

# E2E Tests
npm run test:e2e          # Run E2E tests
npm run test:e2e:ui       # Open Playwright UI
npm run test:e2e:debug    # Debug E2E tests
```

---

## 🏗️ Project Structure

```
casa-web/
├── src/
│   ├── components/
│   │   └── mesa-abierta/
│   │       └── __tests__/          # Component unit tests
│   └── test/
│       └── setup.ts                # Test configuration
├── tests/
│   ├── e2e/                        # End-to-end tests
│   └── integration/                # Integration tests
├── vitest.config.ts                # Vitest configuration
└── playwright.config.ts            # Playwright configuration
```

---

## 🔧 MCP Server Setup

### Prerequisites
- Docker Desktop installed and running
- Claude Code CLI installed

### Available MCP Servers

#### 1. Playwright MCP Server
**Purpose**: Browser automation and E2E testing

```bash
# Installation
claude mcp add playwright npx @playwright/mcp@latest

# Usage
# Ask Claude: "Test the Mesa Abierta signup form"
# Claude will use Playwright to automate browser testing
```

#### 2. Chrome DevTools MCP Server
**Purpose**: Debugging, performance analysis, console monitoring

```bash
# Installation
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest

# Usage
# Ask Claude: "Debug the Mesa Abierta section performance"
# Claude will connect to Chrome and analyze the page
```

#### 3. Supabase MCP Server
**Purpose**: Database queries, schema inspection, data validation

```bash
# Configuration
# The Supabase MCP server uses the hosted version at:
# https://mcp.supabase.com/mcp

# Setup in Claude Code config:
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "env": {
        "SUPABASE_URL": "your-project-url",
        "SUPABASE_KEY": "your-anon-key"
      }
    }
  }
}

# Usage
# Ask Claude: "Query mesa_abierta_participants table"
# Claude will connect to Supabase and run queries
```

### Verify MCP Installation

```bash
# List configured MCP servers
claude mcp list

# Get details about a specific server
claude mcp get playwright
```

---

## 🧪 Writing Tests

### Unit Test Example

```typescript
// src/components/mesa-abierta/__tests__/MyComponent.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('user can complete signup', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Ser Invitado');
  await expect(page.locator('dialog')).toBeVisible();
});
```

---

## 🤖 AI-Assisted Testing with MCP

### Workflow 1: Component Testing with Claude

1. Write your component
2. Ask Claude: *"Create unit tests for the MesaAbiertaSignup component"*
3. Claude will:
   - Analyze the component code
   - Generate comprehensive tests
   - Run the tests and report results

### Workflow 2: E2E Testing with Playwright MCP

1. Deploy your feature to dev
2. Ask Claude: *"Test the complete Mesa Abierta signup flow as a guest"*
3. Claude will:
   - Use Playwright MCP to open a browser
   - Navigate through the multi-step form
   - Verify each step completes successfully
   - Report any issues found

### Workflow 3: Database Testing with Supabase MCP

1. Complete a signup in dev
2. Ask Claude: *"Verify the participant data was saved correctly in Supabase"*
3. Claude will:
   - Connect to Supabase via MCP
   - Query relevant tables
   - Validate data integrity
   - Check RLS policies

### Workflow 4: Performance Debugging with Chrome DevTools MCP

1. Experience slow load times
2. Ask Claude: *"Analyze the Mesa Abierta section performance"*
3. Claude will:
   - Connect to Chrome DevTools
   - Run performance profiling
   - Identify bottlenecks
   - Suggest optimizations

---

## 📊 Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Component Tests**: All user-facing components
- **E2E Tests**: Critical user flows
- **Integration Tests**: Database operations

---

## 🐛 Debugging Tests

### Vitest Debugging

```bash
# Run a specific test file
npm test src/components/mesa-abierta/__tests__/DietaryRestrictionsForm.test.tsx

# Run tests matching a pattern
npm test -- --grep "renders all dietary"

# Open UI for visual debugging
npm run test:ui
```

### Playwright Debugging

```bash
# Run with headed browser
npm run test:e2e -- --headed

# Run specific test
npm run test:e2e -- mesa-abierta-signup

# Debug mode (step through)
npm run test:e2e:debug
```

---

## 🔄 CI/CD Integration

Tests automatically run on:
- Pull requests
- Pushes to main
- Before deployments

**Note**: E2E tests require:
- Supabase dev instance
- Test data seeding
- Environment variables configured

---

## 📝 Best Practices

1. **Write tests first** (TDD approach when possible)
2. **Mock external dependencies** (Supabase, APIs)
3. **Use descriptive test names** (what it tests, expected behavior)
4. **Test user behavior**, not implementation details
5. **Keep tests fast** (<1s for unit, <30s for E2E)
6. **Leverage MCP servers** for complex testing scenarios

---

## 🆘 Troubleshooting

### Vitest Issues

**Problem**: `Cannot find module '@testing-library/react'`
```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

**Problem**: `window is not defined`
- Check that `vitest.config.ts` has `environment: 'jsdom'`

### Playwright Issues

**Problem**: `Browser not found`
```bash
npx playwright install chromium
```

**Problem**: `Test timeout`
- Increase timeout in playwright.config.ts
- Check if dev server is running

### MCP Issues

**Problem**: `MCP server not responding`
```bash
# Restart Claude Code
# Verify server with: claude mcp list
```

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/mcp)

---

## 🎯 Next Steps

1. Run initial tests: `npm test`
2. Install MCP servers (see above)
3. Ask Claude to help write tests for new components
4. Set up CI/CD pipeline
5. Achieve 80%+ test coverage

Happy Testing! 🚀
