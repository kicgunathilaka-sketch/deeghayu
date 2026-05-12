import { BrowserRouter } from 'react-router-dom';
import AppRouter from './router/AppRouter';
import { useUiStore } from './store/uiStore';
import { useEffect } from 'react';

function App() {
  const { theme } = useUiStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
