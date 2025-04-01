
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Create a promise that waits for document ready and fonts loaded
const documentReady = () => {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
};

// Function to check if fonts are loaded
const checkFontsLoaded = () => {
  return document.fonts.ready.then(() => {
    console.log("All fonts are loaded");
    return true;
  }).catch(err => {
    console.error("Error loading fonts:", err);
    return true; // Continue anyway
  });
};

// Function to render app
const renderApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

// Chain promises: first document ready, then fonts loaded, then render
documentReady()
  .then(checkFontsLoaded)
  .then(renderApp)
  .catch(error => {
    console.error("Error during initialization:", error);
    // Render anyway if there's an error
    renderApp();
  });
