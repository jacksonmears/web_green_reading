import { useState } from "react";
import "./App.css";
import TestMath from "./components/TestMath.jsx";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <TestMath />
    </>
  );
}

export default App;
