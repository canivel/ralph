import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4">
        <h1 className="text-2xl font-bold text-foreground">Ralph Dashboard</h1>
      </header>
      <main className="p-4">
        <p className="text-muted-foreground">Dashboard is loading...</p>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:id" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
