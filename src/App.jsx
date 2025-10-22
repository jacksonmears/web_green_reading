import { useState } from "react";
import "./App.css";
import TestMath from "./components/TestMath.jsx";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Vite + React + Emscripten</h1>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>

      <TestMath />
    </>
  );
}

export default App;
